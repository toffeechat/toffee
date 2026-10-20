import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageSenderType, Role } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { appError } from '../common/i18n/app-error.js';
import type { SupportedLocale } from '../common/i18n/locales.js';
import { ensureActiveSubscription } from '../common/authorization/ensure-active-subscription.js';
import { ensureCanViewActor } from '../common/authorization/actor-access.js';
import { quoteInclude, toQuote } from '../messages/messages.service.js';
import {
  ClaudeTranslationProvider,
  FakeTranslationProvider,
  TranslationRefusedError,
  type TranslationProvider,
  type TranslationSpeaker,
} from './translation-provider.js';

const NAME_PLACEHOLDER = '{{name}}';
const DEFAULT_MODEL = 'claude-opus-5-5';
// 팬 답장 번역 모델(2026-10-16 사용자 결정 — 짧고 수가 많아서 싼 모델). 바꾸려면 TRANSLATION_REPLY_MODEL
const DEFAULT_REPLY_MODEL = 'claude-haiku-5-5';
/** 묶음 번역 한 번에 받는 메시지 수 — 화면에 보이는 말풍선 정도 */
export const TRANSLATE_BATCH_MAX = 30;

const MESSAGE_SELECT = {
  id: true,
  body: true,
  senderType: true,
  fanUserId: true,
  createdAt: true,
  // CP방은 보낸 멤버의 성별, 아니면 방(아티스트) 성별
  senderActor: { select: { gender: true } },
  actor: { select: { gender: true } },
} as const;

type TranslatableMessage = {
  senderType: MessageSenderType;
  senderActor: { gender: 'FEMALE' | 'MALE' | null } | null;
  actor: { gender: 'FEMALE' | 'MALE' | null } | null;
};

const speakerOf = (message: TranslatableMessage): TranslationSpeaker =>
  message.senderType === MessageSenderType.ARTIST
    ? { role: 'artist', gender: message.senderActor?.gender ?? message.actor?.gender ?? null }
    : { role: 'fan' };
const WELCOME_CACHE_SIZE = 500;

/**
 * 메시지 번역(2026-09-29, 사용자 결정: 글로벌 서비스라 필수). 누가 번역 버튼을 누를 때만(지연 번역), 메시지 × 언어마다 한 번 번역해서
 * MessageTranslation에 저장 — 같은 메시지를 다른 팬이 같은 언어로 눌러도 다시 번역하지 않음(비용은 메시지당 한 번). 스타 메시지의 {{name}}은
 * 그대로 번역해 두고 보여 줄 때 그 팬 이름으로.
 * 누가 볼 수 있나: 팬은 채팅방에서 보이는 것(구독 시작 이후 스타 메시지 + 내 답장), 스타·소속사·운영자는 그 방의 메시지(팬 답장 포함 —
 * 태국·일본 팬 답장을 배우가 읽을 수 있게).
 * 엔진: TRANSLATION_PROVIDER(claude | fake | off). 비워 두면 ANTHROPIC_API_KEY가 있으면 claude, 없으면 개발은 가짜·운영은 꺼짐.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly provider: TranslationProvider | null;
  // 환영 메시지 번역 기억(방 × 언어 × 원문) — 오래된 것부터 버림
  private readonly welcomeCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.provider = TranslationService.pickProvider(config);
    this.logger.log(`번역 엔진: ${this.provider?.name ?? '꺼짐'}`);
  }

  static pickProvider(config: ConfigService): TranslationProvider | null {
    const choice = config.get<string>('TRANSLATION_PROVIDER');
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    const model = config.get<string>('TRANSLATION_MODEL') || DEFAULT_MODEL;
    const replyModel = config.get<string>('TRANSLATION_REPLY_MODEL') || DEFAULT_REPLY_MODEL;
    if (choice === 'off') return null;
    if (choice === 'fake') return new FakeTranslationProvider();
    if (choice === 'claude' || (!choice && apiKey)) return apiKey ? new ClaudeTranslationProvider(apiKey, model, replyModel) : null;
    return config.get<string>('NODE_ENV') === 'production' ? null : new FakeTranslationProvider();
  }

  get enabled() {
    return !!this.provider;
  }

  async translateMessage(requesterId: string, actorId: string, messageId: string, target: SupportedLocale) {
    if (!this.provider) throw new ServiceUnavailableException(appError('TRANSLATION_UNAVAILABLE'));
    const message = await this.prisma.message.findFirst({ where: { id: messageId, actorId, deletedAt: null }, select: MESSAGE_SELECT });
    if (!message?.body) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
      select: { role: true, nickname: true, displayName: true },
    });
    if (requester.role === Role.USER) {
      // 팬은 자기 채팅방에 보이는 메시지만(다른 팬 답장·구독 전 메시지는 안 보이므로 번역도 불가 — 있는지조차 알려 주지 않게 404)
      const subscription = await ensureActiveSubscription(this.prisma, requesterId, actorId);
      const visible =
        (message.createdAt >= subscription.startedAt && (message.senderType === MessageSenderType.ARTIST || message.fanUserId === requesterId)) ||
        (await this.isVisibleQuote(message.id, actorId, subscription.startedAt));
      if (!visible) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));
    } else {
      await ensureCanViewActor(this.prisma, requesterId, actorId);
    }

    let text = await this.cachedOrTranslate(message.id, message.body, target, speakerOf(message));
    // 팬에게 보여 줄 스타 메시지는 {{name}} 자리에 그 팬 이름(채팅방 원문과 같게)
    if (message.senderType === MessageSenderType.ARTIST && requester.role === Role.USER) {
      text = text.replaceAll(NAME_PLACEHOLDER, requester.nickname ?? requester.displayName ?? '');
    }
    return { messageId: message.id, language: target, text };
  }

  /**
   * 묶음 번역(2026-10-16 자동 번역) — 앱이 화면에 함께 그려진 말풍선들을 모아 한 번에. 권한은 한 개짜리와 같고(팬은 자기 채팅방에 보이는 것만,
   * 안 보이는 건 조용히 빠짐), 저장된 번역은 그대로 쓰고 나머지만 아티스트 메시지끼리·팬 답장끼리 묶어 엔진에 한 번씩. 엔진이 실패하거나
   * 일부를 빠뜨리면 그 메시지만 결과에서 빠짐(앱은 그 말풍선에 "번역 보기" 버튼을 남김)
   */
  async translateMany(requesterId: string, actorId: string, messageIds: string[], target: SupportedLocale) {
    const provider = this.provider;
    if (!provider) throw new ServiceUnavailableException(appError('TRANSLATION_UNAVAILABLE'));
    const ids = [...new Set(messageIds)].slice(0, TRANSLATE_BATCH_MAX);
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
      select: { role: true, nickname: true, displayName: true },
    });
    let rows = await this.prisma.message.findMany({ where: { id: { in: ids }, actorId, deletedAt: null }, select: MESSAGE_SELECT });
    if (requester.role === Role.USER) {
      const subscription = await ensureActiveSubscription(this.prisma, requesterId, actorId);
      const visible = await Promise.all(
        rows.map(
          async (message) =>
            (message.createdAt >= subscription.startedAt && (message.senderType === MessageSenderType.ARTIST || message.fanUserId === requesterId)) ||
            (await this.isVisibleQuote(message.id, actorId, subscription.startedAt)),
        ),
      );
      rows = rows.filter((_, index) => visible[index]);
    } else {
      await ensureCanViewActor(this.prisma, requesterId, actorId);
    }
    const messages = rows.filter((message): message is typeof message & { body: string } => !!message.body);

    const texts = new Map<string, string>();
    if (provider.cacheable && messages.length > 0) {
      const cached = await this.prisma.messageTranslation.findMany({
        where: { messageId: { in: messages.map((message) => message.id) }, languageCode: target },
        select: { messageId: true, translatedText: true },
      });
      for (const row of cached) texts.set(row.messageId, row.translatedText);
    }
    const todo = messages.filter((message) => !texts.has(message.id));
    const groups = [todo.filter((message) => message.senderType === MessageSenderType.ARTIST), todo.filter((message) => message.senderType !== MessageSenderType.ARTIST)];
    await Promise.all(
      groups
        .filter((group) => group.length > 0)
        .map(async (group) => {
          let results: (string | null)[];
          try {
            results = await provider.translateMany(
              group.map((message) => ({ text: message.body, speaker: speakerOf(message) })),
              target,
            );
          } catch (error) {
            this.logger.warn(`묶음 번역 실패(${provider.name}, ${group.length}개): ${error instanceof TranslationRefusedError ? `거절 ${error.message}` : String(error)}`);
            return;
          }
          const fresh = group.flatMap((message, index) => (results[index] ? [{ messageId: message.id, languageCode: target, translatedText: results[index] }] : []));
          for (const row of fresh) texts.set(row.messageId, row.translatedText);
          // 두 사람이 동시에 같은 메시지를 번역했으면 먼저 저장된 것만 남김
          if (provider.cacheable && fresh.length > 0) await this.prisma.messageTranslation.createMany({ data: fresh, skipDuplicates: true });
        }),
    );

    const fanName = requester.nickname ?? requester.displayName ?? '';
    return {
      language: target,
      translations: messages
        .filter((message) => texts.has(message.id))
        .map((message) => {
          const text = texts.get(message.id)!;
          // 팬에게 보여 줄 스타 메시지는 {{name}} 자리에 그 팬 이름(한 개짜리와 같게)
          return {
            messageId: message.id,
            text: message.senderType === MessageSenderType.ARTIST && requester.role === Role.USER ? text.replaceAll(NAME_PLACEHOLDER, fanName) : text,
          };
        }),
    };
  }

  /**
   * 아티스트가 인용해서 답한 다른 팬의 답장(2026-10-15 — 팬 화면에서 인용 말풍선과 아티스트 말풍선을 "번역 보기" 한 번에) — 그 인용 답장이 이 팬에게
   * 보이고(구독 시작 이후·지워지지 않음) 인용이 가려지지 않았을 때만(정지·차단·신고 처리·회수된 팬 답장은 화면에서도 가려지므로 번역도 불가)
   */
  private async isVisibleQuote(messageId: string, actorId: string, since: Date): Promise<boolean> {
    const quoting = await this.prisma.message.findFirst({
      where: { actorId, replyToMessageId: messageId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: { gte: since } },
      select: { id: true },
    });
    if (!quoting) return false;
    const source = await this.prisma.message.findUnique({ where: { id: messageId }, select: quoteInclude(actorId).replyTo.select });
    const quote = toQuote(source, MessageSenderType.ARTIST);
    return !!quote && !quote.hidden;
  }

  /**
   * 환영 메시지 번역(2026-10-15 실기기 — 환영 메시지만 "번역 보기"가 없었음). 환영 메시지는 메시지 행이 아니라(구독 직후 화면에서 만들어 보여 줌)
   * MessageTranslation에 못 넣어서 {{name}}이 든 원문 × 언어로 서버 메모리에 잠깐 기억(같은 방 팬들이 같은 언어로 누르면 한 번만 번역).
   * 아티스트가 문구를 바꾸면 원문이 달라져서 자연히 새로 번역됨
   */
  async translateWelcome(requesterId: string, actorId: string, target: SupportedLocale) {
    if (!this.provider) throw new ServiceUnavailableException(appError('TRANSLATION_UNAVAILABLE'));
    await ensureActiveSubscription(this.prisma, requesterId, actorId);
    const [actor, requester] = await Promise.all([
      this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { welcomeMessage: true, gender: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: requesterId }, select: { nickname: true, displayName: true } }),
    ]);
    if (!actor.welcomeMessage) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));
    const key = `${actorId}\u0000${target}\u0000${actor.welcomeMessage}`;
    let text = this.welcomeCache.get(key);
    if (text === undefined) {
      try {
        text = await this.provider.translate(actor.welcomeMessage, target, { role: 'artist', gender: actor.gender ?? null });
      } catch (error) {
        this.logger.warn(`환영 메시지 번역 실패(${this.provider.name}): ${String(error)}`);
        throw new ServiceUnavailableException(appError('TRANSLATION_FAILED'));
      }
      if (this.provider.cacheable) {
        if (this.welcomeCache.size >= WELCOME_CACHE_SIZE) this.welcomeCache.delete(this.welcomeCache.keys().next().value!);
        this.welcomeCache.set(key, text);
      }
    }
    return { language: target, text: text.replaceAll(NAME_PLACEHOLDER, requester.nickname ?? requester.displayName ?? '') };
  }

  /**
   * 공지 번역(2026-10-20 사용자 결정: 한국어로 쓰고 다른 언어 팬은 [번역 보기]) — 공지 × 언어마다 처음 누른 사람 때 번역해서 NoticeTranslation에 저장,
   * 공지를 고치면(updatedAt이 바뀌면) 다시 번역. 공지는 로그인한 누구나 보는 글이라 권한 확인은 없음
   */
  async translateNotice(noticeId: string, target: SupportedLocale) {
    if (!this.provider) throw new ServiceUnavailableException(appError('TRANSLATION_UNAVAILABLE'));
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId }, select: { title: true, body: true, updatedAt: true } });
    if (!notice) throw new NotFoundException(appError('NOT_FOUND'));
    const cached = await this.prisma.noticeTranslation.findUnique({ where: { noticeId_language: { noticeId, language: target } } });
    if (cached && cached.sourceUpdatedAt.getTime() === notice.updatedAt.getTime()) return { language: target, title: cached.title, body: cached.body };
    let title: string;
    let body: string;
    try {
      [title, body] = await Promise.all([this.provider.translate(notice.title, target), this.provider.translate(notice.body, target)]);
    } catch (error) {
      this.logger.warn(`공지 번역 실패(${this.provider.name}): ${String(error)}`);
      throw new ServiceUnavailableException(appError('TRANSLATION_FAILED'));
    }
    if (this.provider.cacheable) {
      const data = { title, body, sourceUpdatedAt: notice.updatedAt };
      await this.prisma.noticeTranslation.upsert({ where: { noticeId_language: { noticeId, language: target } }, create: { noticeId, language: target, ...data }, update: data });
    }
    return { language: target, title, body };
  }

  private async cachedOrTranslate(messageId: string, body: string, target: SupportedLocale, speaker: TranslationSpeaker): Promise<string> {
    const provider = this.provider!;
    if (provider.cacheable) {
      const cached = await this.prisma.messageTranslation.findUnique({ where: { messageId_languageCode: { messageId, languageCode: target } } });
      if (cached) return cached.translatedText;
    }
    let translated: string;
    try {
      translated = await provider.translate(body, target, speaker);
    } catch (error) {
      this.logger.warn(`번역 실패(${provider.name}): ${error instanceof TranslationRefusedError ? `거절 ${error.message}` : String(error)}`);
      throw new ServiceUnavailableException(appError('TRANSLATION_FAILED'));
    }
    if (!provider.cacheable) return translated;
    try {
      await this.prisma.messageTranslation.create({ data: { messageId, languageCode: target, translatedText: translated } });
    } catch (error) {
      // 두 사람이 동시에 눌러 먼저 저장된 게 있으면 그걸 씀
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      const saved = await this.prisma.messageTranslation.findUniqueOrThrow({ where: { messageId_languageCode: { messageId, languageCode: target } } });
      return saved.translatedText;
    }
    return translated;
  }
}
