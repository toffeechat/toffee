import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageSenderType } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { appError } from '../common/i18n/app-error.js';
import type { SupportedLocale } from '../common/i18n/locales.js';
import { ensureActiveSubscription } from '../common/authorization/ensure-active-subscription.js';
import { QUOTE_PREVIEW_LENGTH, quoteInclude, toQuote, viewerSince } from '../messages/messages.service.js';
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
  /**
   * 지금 엔진에 맡긴 번역(메시지 × 언어) — 같은 걸 또 부탁하면 엔진을 다시 부르지 않고 이걸 기다림(2026-10-27). 인기 방에 새 메시지가 오면 팬 수천 명이
   * 동시에 자동 번역을 요청해서, 저장된 번역이 생기기 전까지 모두 유료 엔진을 불렀음. 서버 한 대 안에서만 묶임(서버가 n대면 최대 n번)
   */
  private readonly inFlight = new Map<string, Promise<string | null>>();

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
    // 팬(또는 다른 방을 구독한 아티스트·소속사 계정, 2026-10-27)은 since 이후 자기 채팅방에 보이는 것만, 그 방 스태프·본인·운영자는 전부
    const since = await viewerSince(this.prisma, requesterId, actorId, requester.role);
    let quoteOnly = false;
    if (since) {
      // 팬은 자기 채팅방에 보이는 메시지만(다른 팬 답장·구독 전 메시지는 안 보이므로 번역도 불가 — 있는지조차 알려 주지 않게 404)
      const visibility = await this.fanVisibility(message, requesterId, actorId, since);
      if (!visibility) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));
      quoteOnly = visibility === 'quote';
    }

    const source = this.sourceFor(message.body, quoteOnly);
    let text = await this.cachedOrTranslate(message.id, source, target, speakerOf(message));
    // 팬에게 보여 줄 스타 메시지는 {{name}} 자리에 그 팬 이름(채팅방 원문과 같게)
    if (message.senderType === MessageSenderType.ARTIST && since) {
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
    const rows = await this.prisma.message.findMany({ where: { id: { in: ids }, actorId, deletedAt: null }, select: MESSAGE_SELECT });
    const since = await viewerSince(this.prisma, requesterId, actorId, requester.role);
    const visibility = since
      ? await Promise.all(rows.map((message) => this.fanVisibility(message, requesterId, actorId, since)))
      : rows.map(() => 'full' as const);
    const messages = rows.flatMap((message, index) => {
      const seen = visibility[index];
      return message.body && seen ? [{ ...message, source: this.sourceFor(message.body, seen === 'quote') }] : [];
    });

    // 같은 번역을 다른 요청이 이미 엔진에 맡겼으면 그걸 기다리고, 아니면 내가 맡음 — 기다리는 사이 다른 요청이 끼어들지 않게 await 없이 바로 등록
    const texts = new Map<string, string>();
    const waiting: Promise<void>[] = [];
    const owned: ((typeof messages)[number] & { settle: (text: string | null) => void })[] = [];
    for (const message of messages) {
      const key = this.flightKey(message.id, target, message.source);
      const pending = this.inFlight.get(key);
      if (pending) {
        waiting.push(pending.then((text) => void (text !== null && texts.set(message.id, text))));
        continue;
      }
      let settle!: (text: string | null) => void;
      const promise = new Promise<string | null>((resolve) => (settle = resolve)).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, promise);
      owned.push({ ...message, settle });
    }

    try {
      const shared = owned.filter((message) => message.source.shared);
      if (provider.cacheable && shared.length > 0) {
        const cached = await this.prisma.messageTranslation.findMany({
          where: { messageId: { in: shared.map((message) => message.id) }, languageCode: target },
          select: { messageId: true, translatedText: true },
        });
        for (const row of cached) texts.set(row.messageId, row.translatedText);
      }
      const todo = owned.filter((message) => !texts.has(message.id));
      const groups = [todo.filter((message) => message.senderType === MessageSenderType.ARTIST), todo.filter((message) => message.senderType !== MessageSenderType.ARTIST)];
      await Promise.all(
        groups
          .filter((group) => group.length > 0)
          .map(async (group) => {
            let results: (string | null)[];
            try {
              results = await provider.translateMany(
                group.map((message) => ({ text: message.source.text, speaker: speakerOf(message) })),
                target,
              );
            } catch (error) {
              this.logger.warn(`묶음 번역 실패(${provider.name}, ${group.length}개): ${error instanceof TranslationRefusedError ? `거절 ${error.message}` : String(error)}`);
              return;
            }
            group.forEach((message, index) => {
              if (results[index]) texts.set(message.id, results[index]);
            });
            // 인용 앞부분만 번역한 건 저장하지 않음(전체 번역 자리에 섞이면 안 됨). 두 사람이 동시에 같은 메시지를 번역했으면 먼저 저장된 것만 남김
            const fresh = group.flatMap((message, index) =>
              results[index] && message.source.shared ? [{ messageId: message.id, languageCode: target, translatedText: results[index] }] : [],
            );
            if (provider.cacheable && fresh.length > 0) await this.prisma.messageTranslation.createMany({ data: fresh, skipDuplicates: true });
          }),
      );
    } finally {
      for (const message of owned) message.settle(texts.get(message.id) ?? null);
    }
    await Promise.all(waiting);

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
            text: message.senderType === MessageSenderType.ARTIST && since ? text.replaceAll(NAME_PLACEHOLDER, fanName) : text,
          };
        }),
    };
  }

  /**
   * 팬 채팅방에 이 메시지가 어떻게 보이는지 — 'full'(구독 이후 스타 메시지·내 답장), 'quote'(아티스트가 인용한 다른 팬 답장이라 인용 칸에 앞부분만), null(안 보임)
   */
  private async fanVisibility(
    message: { id: string; createdAt: Date; senderType: MessageSenderType; fanUserId: string | null },
    requesterId: string,
    actorId: string,
    since: Date,
  ): Promise<'full' | 'quote' | null> {
    if (message.createdAt >= since && (message.senderType === MessageSenderType.ARTIST || message.fanUserId === requesterId)) return 'full';
    return (await this.isVisibleQuote(message.id, actorId, since)) ? 'quote' : null;
  }

  /**
   * 번역할 원문(2026-10-27) — 인용으로만 보이는 메시지는 화면처럼 앞 QUOTE_PREVIEW_LENGTH자만(예전엔 번역으로 전체 글이 보였음). 잘린 번역은 메시지 × 언어
   * 저장 자리(전체 번역)에 넣지 않음(shared: false). 짧아서 안 잘리면 전체와 같으니 저장된 번역을 같이 씀
   */
  private sourceFor(body: string, quoteOnly: boolean): { text: string; shared: boolean } {
    if (!quoteOnly || body.length <= QUOTE_PREVIEW_LENGTH) return { text: body, shared: true };
    return { text: body.slice(0, QUOTE_PREVIEW_LENGTH), shared: false };
  }

  private flightKey(messageId: string, target: SupportedLocale, source: { shared: boolean }) {
    return `${messageId}:${target}${source.shared ? '' : ':quote'}`;
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

  /** 한 개짜리 번역 — 같은 메시지 × 언어를 이미 엔진에 맡긴 요청(한 개·묶음)이 있으면 그걸 기다림(2026-10-27) */
  private async cachedOrTranslate(messageId: string, source: { text: string; shared: boolean }, target: SupportedLocale, speaker: TranslationSpeaker): Promise<string> {
    const key = this.flightKey(messageId, target, source);
    let pending = this.inFlight.get(key);
    if (!pending) {
      const owned = this.translateNow(messageId, source, target, speaker);
      pending = owned.catch(() => null).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
      // 맡은 요청은 원래 오류(거절·저장 실패)를 그대로 받음
      return owned;
    }
    const text = await pending;
    if (text === null) throw new ServiceUnavailableException(appError('TRANSLATION_FAILED'));
    return text;
  }

  private async translateNow(messageId: string, source: { text: string; shared: boolean }, target: SupportedLocale, speaker: TranslationSpeaker): Promise<string> {
    const provider = this.provider!;
    const body = source.text;
    // 인용 앞부분만 번역한 건 저장된 전체 번역을 쓰지도, 저장하지도 않음
    if (!source.shared) {
      try {
        return await provider.translate(body, target, speaker);
      } catch (error) {
        this.logger.warn(`번역 실패(${provider.name}): ${error instanceof TranslationRefusedError ? `거절 ${error.message}` : String(error)}`);
        throw new ServiceUnavailableException(appError('TRANSLATION_FAILED'));
      }
    }
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
