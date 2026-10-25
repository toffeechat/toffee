import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { MediaService } from '../storage/media.service.js';
import { ActorKind, MessageMediaType, MessageSenderType, ReportStatus, Role, UserStatus } from '../generated/prisma/enums.js';
import { ensureCanViewActor, ensureIsActorSelf } from '../common/authorization/actor-access.js';
import { ensureActiveSubscription } from '../common/authorization/ensure-active-subscription.js';
import { fanTag } from '../common/nickname/nickname.js';
import type { SendReplyDto } from './dto/send-reply.dto.js';
import type { SendBroadcastDto } from './dto/send-broadcast.dto.js';
import { appError } from '../common/i18n/app-error.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { escapeLike } from '../common/utils/escape-like.js';

const NAME_PLACEHOLDER = '{{name}}';
const QUOTE_PREVIEW_LENGTH = 120;

// 스타의 인용 답장이 가리키는 팬 메시지 — 화면에 보여줄 요약만 가져옴(이 채널에서 차단됐는지도 같이)
export function quoteInclude(actorId: string) {
  return {
    replyTo: {
      select: {
        id: true,
        senderType: true,
        body: true,
        mediaType: true,
        fanUserId: true,
        // 팬이 회수한 답장(2026-10-14) — 인용 칸에 "회수된 메시지"
        deletedAt: true,
        // CP방에서 상대 아티스트 메시지를 인용한 경우(2026-10-15) — 인용 칸 제목에 그 아티스트 이름
        senderActor: { select: { chatDisplayName: true } },
        fanUser: {
          select: {
            nickname: true,
            status: true,
            deletedAt: true,
            blockedInChannels: { where: { actorId }, select: { id: true }, take: 1 },
          },
        },
        reports: { where: { status: ReportStatus.RESOLVED }, select: { id: true }, take: 1 },
      },
    },
  } as const;
}

interface QuotedSource {
  id: string;
  fanUserId?: string | null;
  senderType: MessageSenderType;
  body: string | null;
  mediaType: MessageMediaType;
  deletedAt?: Date | null;
  senderActor?: { chatDisplayName: string } | null;
  fanUser: { nickname: string | null; status: UserStatus; deletedAt?: Date | null; blockedInChannels?: { id: string }[] } | null;
  reports: { id: string }[];
}

/**
 * 인용 표시용 요약 — 스타가 팬 메시지를 인용한 경우만(팬 답장이 자동으로 묶인 스타 메시지는 인용이 아니라서
 * 안 보여줌, 버블 방식). 인용된 팬이 정지·차단됐거나 그 메시지가 신고 처리(RESOLVED)됐으면 내용을 가림.
 * 인용 답장은 전체 구독자에게 보이므로 팬은 닉네임으로만(2026-09-28 확정).
 */
// quotingSenderType: 인용한 쪽 — 팬 답장의 replyTo는 "보낸 시점의 최신 아티스트 메시지"로 자동으로 묶인 거라 인용이 아님. 아티스트 메시지를 인용한 건
// 아티스트(CP방 상대)가 보낸 경우만
export function toQuote(source: QuotedSource | null, quotingSenderType?: MessageSenderType) {
  if (!source) return null;
  // CP방 두 아티스트가 서로의 메시지에 답장(2026-10-15 사용자 결정, 1차) — 아티스트는 공개된 사람이라 이름을 그대로, 회수됐으면 "회수된 메시지"
  if (source.senderType === MessageSenderType.ARTIST && quotingSenderType === MessageSenderType.ARTIST) {
    const retracted = !!source.deletedAt;
    return {
      id: source.id,
      hidden: retracted,
      retracted,
      nickname: null,
      artistName: source.senderActor?.chatDisplayName ?? null,
      body: retracted || !source.body ? null : source.body.slice(0, QUOTE_PREVIEW_LENGTH),
    };
  }
  if (source.senderType !== MessageSenderType.FAN) return null;
  const hidden =
    !source.fanUser ||
    source.fanUser.status !== UserStatus.ACTIVE ||
    !!source.fanUser.deletedAt ||
    (source.fanUser.blockedInChannels?.length ?? 0) > 0 ||
    source.reports.length > 0;
  const retracted = !!source.deletedAt;
  return {
    id: source.id,
    hidden: hidden || retracted,
    retracted,
    nickname: hidden || retracted ? null : (source.fanUser?.nickname ?? null),
    body: hidden || retracted || !source.body ? null : source.body.slice(0, QUOTE_PREVIEW_LENGTH),
  };
}

// 이 배우 채널에서 차단되지 않은 팬
function notBlockedIn(actorId: string) {
  return { blockedInChannels: { none: { actorId } } };
}

function withQuote<T extends { replyTo: QuotedSource | null; senderType: MessageSenderType }>(message: T) {
  const { replyTo, ...rest } = message;
  return { ...rest, replyTo: toQuote(replyTo, message.senderType) };
}

/**
 * 회수한 메시지(2026-10-14 사용자 결정 — "삭제" 대신 "회수") — 자리만 남기고 내용은 비움. 앱은 "회수된 메시지입니다"로 그림.
 * 원본은 DB에 그대로(신고 증거·운영자 확인용) — 화면으로만 안 내려줌
 */
function asRetracted<T extends { body: string | null; mediaKey?: string | null }>(message: T): T & { retracted: boolean } {
  return {
    ...message,
    body: null,
    mediaKey: null,
    thumbnailKey: null,
    thumbhash: null,
    waveform: null,
    mediaDurationMs: null,
    replyTo: null,
    retracted: true,
  };
}

// 팬 화면에 남는 회수 — 아티스트 본인이 회수한 스타 메시지와 팬 본인이 회수한 답장. 소속사·운영자가 지운 건 흔적 없이 사라짐(사고 대응)
const RETRACTED_BY_SENDER = { deletedByAdmin: false, deletedByStaffId: null } as const;
const PUSH_PREVIEW_LENGTH = 60;
// 스타 화면 "팬 답장 흐름" 미리보기 — 최근 스타 메시지 몇 개에만, 메시지당 최근 답장 몇 개만(오래된 메시지는 숫자만)
const REPLY_PREVIEW_MESSAGES = 10;
const REPLY_PREVIEW_PER_MESSAGE = 20;
const REPLY_PREVIEW_LENGTH = 80;


// 중복 방지 키 고유 제약(actorId + clientMessageId) 위반 — 같은 키 요청 두 개가 동시에 저장하려 함
function isClientMessageIdConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = (error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } | undefined) ?? {};
  const fields = Array.isArray(target.target) ? target.target : (target.driverAdapterError?.cause?.constraint?.fields ?? []);
  // 어떤 제약인지 못 읽으면(드라이버마다 다름) 이 테이블엔 다른 고유 제약이 없으니 키 충돌로 봄
  return fields.length === 0 || fields.some((field) => String(field).includes('clientMessageId'));
}

function personalize(body: string, fanName: string): string {
  return body.replaceAll(NAME_PLACEHOLDER, fanName);
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly moderationService: ModerationService,
    private readonly mediaService: MediaService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  // 스타 메시지 하나당 팬 1명이 보낼 수 있는 답장 수(버블 방식, 잠정 3 — STATUS.md 출시 전 확정 정책). 설정값으로 조정
  private get repliesPerMessage(): number {
    const value = Number(this.config.get<string>('FAN_REPLIES_PER_MESSAGE'));
    return Number.isInteger(value) && value > 0 ? value : 3;
  }

  // 팬이 지금 답장할 대상(구독 이후 가장 최근의, 지워지지 않은 스타 메시지)과 거기에 이미 보낸 답장 수
  private async replyTarget(userId: string, actorId: string, since: Date, db: Pick<PrismaService, 'message'> = this.prisma) {
    const target = await db.message.findFirst({
      where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const used = target
      ? await db.message.count({ where: { replyToMessageId: target.id, fanUserId: userId, senderType: MessageSenderType.FAN } })
      : 0;
    return { target, used };
  }

  /** 팬 화면 입력창 위 "남은 답장 N개" */
  async replyQuota(userId: string, actorId: string) {
    const subscription = await ensureActiveSubscription(this.prisma, userId, actorId);
    const [{ target, used }, block] = await Promise.all([
      this.replyTarget(userId, actorId, subscription.startedAt),
      this.prisma.actorFanBlock.findUnique({ where: { actorId_fanUserId: { actorId, fanUserId: userId } }, select: { id: true } }),
    ]);
    const limit = this.repliesPerMessage;
    // 차단된 팬은 입력칸을 미리 막음(2026-10-20 — 예전엔 보내 봐야 REPLY_BLOCKED가 뜨고 그 아래 "남은 답장 3개"가 같이 보였음)
    const blocked = !!block;
    return { messageId: target?.id ?? null, limit, used, remaining: target && !blocked ? Math.max(limit - used, 0) : 0, blocked };
  }

  // 팬 본인의 대화방: 구독 시작일 이후의 방송 메시지 + 본인이 보낸 답장만. page.limit를 주면 최신 → 오래된 순으로
  // N개(before 이전), 안 주면 전부 시간순(예전 방식). 오래 구독할수록 대화가 길어져서 앱은 나눠 받음(2026-09-28 점검)
  async listForFan(userId: string, actorId: string, page: { limit?: number; before?: string } = {}) {
    const subscription = await ensureActiveSubscription(this.prisma, userId, actorId);
    const messages = await this.prisma.message.findMany({
      where: {
        actorId,
        createdAt: { gte: subscription.startedAt },
        // 소속사가 지웠거나 운영자가 가린 스타 메시지는 팬에게 안 보임. 아티스트가 직접 회수한 것·내가 회수한 답장은 "회수된 메시지"로 자리만(2026-10-14)
        OR: [
          { senderType: MessageSenderType.ARTIST, OR: [{ deletedAt: null }, RETRACTED_BY_SENDER] },
          { fanUserId: userId },
        ],
      },
      include: quoteInclude(actorId),
      orderBy: page.limit ? [{ createdAt: 'desc' }, { id: 'desc' }] : { createdAt: 'asc' },
      ...(page.limit ? { take: page.limit } : {}),
      ...(page.limit && page.before ? { cursor: { id: page.before }, skip: 1 } : {}),
    });

    const fan = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // 채팅방을 보고 있으면 읽음 처리(인박스 안 읽은 개수 기준) — 응답은 기다리지 않음
    void this.prisma.subscription
      .update({ where: { userId_actorId: { userId, actorId } }, data: { lastReadAt: new Date() } })
      .catch(() => {});
    return this.withSenders(
      await this.mediaService.withReadUrls(
        // quotedMe: 아티스트가 바로 이 팬의 메시지를 인용한 답장(2026-10-13) — 그 팬 화면에만 "내 메시지에 답장" 표시(누구의 id인지는 안 내려줌).
        // 팬 화면엔 인용된 팬 닉네임을 안 내려줌(2026-10-13 사용자 결정, 버블처럼 "아티스트의 답장"만) — 아티스트·소속사 화면은 그대로 닉네임
        messages.map((message) => {
          const quoted = withQuote(message);
          return {
            ...quoted,
            // 상대 아티스트 메시지를 인용한 거면(CP방) 그 글의 {{name}}도 이 팬 이름으로
            replyTo: quoted.replyTo
              ? {
                  ...quoted.replyTo,
                  nickname: null,
                  body: quoted.replyTo.artistName && quoted.replyTo.body ? personalize(quoted.replyTo.body, fan.nickname ?? fan.displayName) : quoted.replyTo.body,
                }
              : null,
            quotedMe: message.senderType === MessageSenderType.ARTIST && message.replyTo?.fanUserId === userId,
          };
        }).map((message) =>
          message.deletedAt
            ? asRetracted(message)
            : {
                ...message,
                body:
                  message.senderType === MessageSenderType.ARTIST && message.body
                    ? personalize(message.body, fan.nickname ?? fan.displayName)
                    : message.body,
              },
        ),
      ),
    );
  }

  /**
   * 스타 메시지에 보낸 배우(이름·대화방 사진)를 붙임 — 커플방에서 말풍선마다 누가 보냈는지 보여 주려고(2026-09-29). 1인 방도
   * 같이 붙지만 앱은 커플방일 때만 씀. 같은 배우는 한 번만 조회.
   */
  private async withSenders<T extends { senderActorId?: string | null }>(messages: T[]) {
    const ids = [...new Set(messages.map((message) => message.senderActorId).filter((id): id is string => !!id))];
    if (ids.length === 0) return messages.map((message) => ({ ...message, sender: null }));
    const actors = await this.prisma.actor.findMany({ where: { id: { in: ids } }, select: { id: true, chatDisplayName: true, chatProfileImageUrl: true } });
    const byId = new Map(
      await Promise.all(
        actors.map(async (actor) => [actor.id, { ...actor, chatProfileImageUrl: await this.mediaService.resolveImageUrl(actor.chatProfileImageUrl) }] as const),
      ),
    );
    return messages.map((message) => ({ ...message, sender: (message.senderActorId && byId.get(message.senderActorId)) || null }));
  }

  /**
   * 팬 채팅방 "사진·영상 모아보기"·전체 화면 넘겨보기(2026-09-29) — 이 팬이 볼 수 있는(구독 시작 이후, 지워지지 않은) 스타의
   * 사진·영상만, 최신 → 오래된 순으로 limit개(before 이전). total은 "3 / 12" 표시용.
   */
  async listMediaForFan(userId: string, actorId: string, page: { limit?: number; before?: string } = {}) {
    // 팬은 구독 시작 이후 것만, 아티스트 본인·소속사·운영자는 그 방 전체(2026-10-15 — 스튜디오 사진 전체 화면에서도 좌우로 넘겨 보게)
    const { role } = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    let since: Date | undefined;
    if (role === Role.USER) since = (await ensureActiveSubscription(this.prisma, userId, actorId)).startedAt;
    else await ensureCanViewActor(this.prisma, userId, actorId);
    const where = {
      actorId,
      senderType: MessageSenderType.ARTIST,
      deletedAt: null,
      ...(since ? { createdAt: { gte: since } } : {}),
      mediaType: { in: [MessageMediaType.PHOTO, MessageMediaType.VIDEO] },
      // 저장소에 올린 파일(mediaKey) 또는 예전 방식 주소(mediaUrl) — 둘 다 없는 건 뺌
      OR: [{ mediaKey: { not: null } }, { mediaUrl: { not: null } }],
    };
    const limit = page.limit ?? 60;
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        select: { id: true, mediaType: true, mediaUrl: true, mediaKey: true, thumbnailKey: true, thumbhash: true, mediaDurationMs: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        ...(page.before ? { cursor: { id: page.before }, skip: 1 } : {}),
      }),
      this.prisma.message.count({ where }),
    ]);
    return { items: await this.mediaService.withReadUrls(items), total };
  }

  /**
   * 팬 채팅방 안 검색(2026-09-29) — 이 팬이 볼 수 있는 메시지(구독 시작 이후, 지워지지 않은 스타 메시지 + 본인 답장) 중 글에
   * q가 들어간 것만, 최신 → 오래된 순으로 limit개(before 이전). 스타 글의 {{name}} 자리엔 팬 이름이 들어가므로, 팬 이름에 q가
   * 들어 있으면 그 자리가 있는 글도 같이 찾음. 결과를 누르면 앱이 대화방의 해당 위치로 이동함(id만 있으면 됨).
   */
  async searchForFan(userId: string, actorId: string, q: string, page: { limit?: number; before?: string } = {}) {
    const subscription = await ensureActiveSubscription(this.prisma, userId, actorId);
    const query = q.trim();
    if (query.length < 2) throw new BadRequestException(appError('SEARCH_QUERY_TOO_SHORT'));
    const fan = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nickname: true, displayName: true } });
    const fanName = fan.nickname ?? fan.displayName;
    const matchesName = !!fanName && fanName.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const messages = await this.prisma.message.findMany({
      where: {
        actorId,
        createdAt: { gte: subscription.startedAt },
        deletedAt: null,
        AND: [
          { OR: [{ senderType: MessageSenderType.ARTIST }, { fanUserId: userId }] },
          {
            OR: [
              { body: { contains: escapeLike(query), mode: 'insensitive' } },
              ...(matchesName ? [{ senderType: MessageSenderType.ARTIST, body: { contains: NAME_PLACEHOLDER } }] : []),
            ],
          },
        ],
      },
      select: { id: true, senderType: true, senderActorId: true, body: true, mediaType: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit ?? 30,
      ...(page.before ? { cursor: { id: page.before }, skip: 1 } : {}),
    });
    return this.withSenders(
      messages.map((message) => ({
        ...message,
        body: message.senderType === MessageSenderType.ARTIST && message.body ? personalize(message.body, fanName) : message.body,
      })),
    );
  }

  /**
   * 같은 중복 방지 키로 이미 저장된 메시지(2026-10-25) — 응답이 끊겨 앱이 다시 보낸 경우. 같은 사람이 같은 방에 보낸 것만 인정하고,
   * 키가 다른 사람·다른 종류 메시지와 겹치면(정상 앱에선 안 생김) 409
   */
  private async sentBefore<T extends Prisma.MessageInclude | undefined = undefined>(
    actorId: string,
    clientMessageId: string | undefined,
    owner: { senderType: MessageSenderType; fanUserId?: string; senderActorId?: string | null },
    include?: T,
    db: Pick<PrismaService, 'message'> = this.prisma,
  ) {
    if (!clientMessageId) return null;
    const existing = await db.message.findUnique({
      where: { actorId_clientMessageId: { actorId, clientMessageId } },
      include,
    });
    if (!existing) return null;
    const same =
      existing.senderType === owner.senderType &&
      (owner.senderType === MessageSenderType.FAN ? existing.fanUserId === owner.fanUserId : existing.senderActorId === owner.senderActorId);
    if (!same) throw new ConflictException(appError('CONFLICT'));
    return existing as Prisma.MessageGetPayload<{ include: T }>;
  }

  async sendReply(userId: string, actorId: string, dto: SendReplyDto) {
    const subscription = await ensureActiveSubscription(this.prisma, userId, actorId);
    const owner = { senderType: MessageSenderType.FAN, fanUserId: userId };
    // 다시 보낸 답장(응답이 끊겼던 것) — 이미 저장됐으면 그대로 돌려줌. 차단·한도 확인보다 먼저(이미 보낸 건 보낸 것)
    const resent = await this.sentBefore(actorId, dto.clientMessageId, owner);
    if (resent) return resent;
    // 채널 차단: 구독·열람은 그대로지만 답장은 못 보냄(잠정 정책 — 차단 사실을 알림, STATUS.md)
    const blocked = await this.prisma.actorFanBlock.findUnique({
      where: { actorId_fanUserId: { actorId, fanUserId: userId } },
      select: { id: true },
    });
    if (blocked) throw new ForbiddenException(appError('REPLY_BLOCKED'));
    await this.moderationService.assertNoBannedWords(dto.body);
    let saved: { message: Prisma.MessageGetPayload<object>; isNew: boolean };
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        // 같은 팬·같은 방 답장은 한 줄로 — 예전엔 두 번 연달아 누르거나(또는 응답이 끊겨 다시 보낼 때) 두 요청이 같이 "아직 2개"를
        // 보고 둘 다 저장돼서 한도(3개)를 넘을 수 있었음(2026-10-25). 트랜잭션이 끝나면 자동으로 풀림
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fan-reply:${actorId}:${userId}`}))`;
        // 줄을 서는 사이 같은 키의 앞 요청이 저장했을 수 있음
        const raced = await this.sentBefore(actorId, dto.clientMessageId, owner, undefined, tx);
        if (raced) return { message: raced, isNew: false };
        // 버블 방식: 팬은 대상을 고르지 않고, 지금 팬 화면에 보이는 가장 최근 스타 메시지에 대한 답장이 됨
        // (구독 전·삭제된 메시지는 팬에게 안 보이므로 제외). 스타 화면은 이걸로 메시지별 답장을 묶어 보여줌.
        const { target: latestArtistMessage, used } = await this.replyTarget(userId, actorId, subscription.startedAt, tx);
        // 스타 메시지가 오기 전엔 답장할 곳이 없음 — 예전엔 대상 없이 저장돼서 스타의 "메시지별 답장" 어디에도 안 보였음
        if (!latestArtistMessage) throw new BadRequestException(appError('REPLY_BEFORE_FIRST'));
        if (used >= this.repliesPerMessage) {
          throw new BadRequestException(appError('REPLY_LIMIT', { limit: this.repliesPerMessage }));
        }
        const created = await tx.message.create({
          data: {
            actorId,
            senderType: MessageSenderType.FAN,
            fanUserId: userId,
            body: dto.body,
            replyToMessageId: latestArtistMessage.id,
            clientMessageId: dto.clientMessageId ?? null,
          },
        });
        await tx.subscription.update({
          where: { userId_actorId: { userId, actorId } },
          data: { lastFanReplyAt: new Date() },
        });
        return { message: created, isNew: true };
      });
    } catch (error) {
      // 잠금으로 막지만 혹시 같은 키가 동시에 들어와 고유 제약에 걸리면 먼저 저장된 것을 돌려줌
      const duplicate = isClientMessageIdConflict(error) ? await this.sentBefore(actorId, dto.clientMessageId, owner) : null;
      if (duplicate) return duplicate;
      throw error;
    }
    // 새로 저장했을 때만 신호(다시 보낸 답장이면 처음 요청이 이미 보냄)
    if (saved.isNew) void this.realtime.publish({ kind: 'fan-reply', actorId, messageId: saved.message.replyToMessageId ?? undefined });
    return saved.message;
  }

  async sendBroadcast(actorSelfUserId: string, actorId: string, dto: SendBroadcastDto) {
    // 커플방이면 두 멤버 중 실제로 보낸 배우(말풍선·알림에 이름 표시)
    const senderActorId = await ensureIsActorSelf(this.prisma, actorSelfUserId, actorId);
    // 다시 보낸 메시지(서버는 저장했는데 응답이 끊김, 2026-10-25) — 새로 저장·알림하지 않고 처음 저장한 것을 그대로 돌려줌
    const owner = { senderType: MessageSenderType.ARTIST, senderActorId };
    const resent = await this.sentBefore(actorId, dto.clientMessageId, owner, quoteInclude(actorId));
    if (resent) return this.presentSent(resent);
    // 환영·생일 메시지를 써 둬야 보낼 수 있음(2026-10-13 사용자 결정 — 앱은 첫 화면에서 먼저 쓰게 함, 여긴 우회 방지)
    // CP방은 환영 메시지만 필수(2026-10-14 사용자 결정)
    const greetings = await this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { kind: true, welcomeMessage: true, birthdayMessage: true } });
    if (!greetings.welcomeMessage || (greetings.kind !== ActorKind.COUPLE && !greetings.birthdayMessage)) {
      throw new BadRequestException(appError('GREETINGS_REQUIRED'));
    }
    const mediaKey = dto.mediaType === MessageMediaType.TEXT ? null : dto.mediaKey!;
    // 인용 답장: 같은 방의 팬 메시지, 또는 CP방이면 상대 아티스트의 메시지(2026-10-15)만. 다른 방·내 메시지·회수된 메시지는 불가
    let quotedArtistActorId: string | null = null;
    if (dto.replyToMessageId) {
      const quoted = await this.prisma.message.findFirst({
        where: { id: dto.replyToMessageId, actorId },
        select: { senderType: true, senderActorId: true, deletedAt: true },
      });
      const fanQuote = quoted?.senderType === MessageSenderType.FAN;
      const partnerQuote =
        quoted?.senderType === MessageSenderType.ARTIST &&
        greetings.kind === ActorKind.COUPLE &&
        !quoted.deletedAt &&
        !!quoted.senderActorId &&
        quoted.senderActorId !== senderActorId;
      if (!fanQuote && !partnerQuote) throw new BadRequestException(appError('QUOTE_INVALID'));
      if (partnerQuote) quotedArtistActorId = quoted!.senderActorId;
    }
    if (mediaKey) await this.mediaService.verifyForAttach(actorId, 'message', dto.mediaType as Exclude<MessageMediaType, 'TEXT'>, mediaKey);
    const thumbnailKey = dto.mediaType === MessageMediaType.VIDEO && dto.thumbnailKey ? dto.thumbnailKey : null;
    if (thumbnailKey) await this.mediaService.verifyForAttach(actorId, 'message', MessageMediaType.PHOTO, thumbnailKey);

    let created;
    try {
      created = await this.prisma.message.create({
        data: {
          actorId,
          senderActorId,
          senderType: MessageSenderType.ARTIST,
          clientMessageId: dto.clientMessageId ?? null,
          mediaType: dto.mediaType,
          body: dto.body,
          mediaKey,
          thumbnailKey,
          thumbhash: dto.mediaType === MessageMediaType.PHOTO || dto.mediaType === MessageMediaType.VIDEO ? (dto.thumbhash ?? null) : null,
          replyToMessageId: dto.replyToMessageId ?? null,
          // 길이는 음성·영상 모두(말풍선에 표시), 음파는 음성만
          ...(dto.mediaType === MessageMediaType.AUDIO || dto.mediaType === MessageMediaType.VIDEO
            ? { mediaDurationMs: dto.durationMs ?? null }
            : {}),
          ...(dto.mediaType === MessageMediaType.AUDIO ? { waveform: dto.waveform ?? undefined } : {}),
        },
        include: quoteInclude(actorId),
      });
    } catch (error) {
      // 같은 키의 요청이 동시에 두 개 들어옴(응답을 못 받은 앱이 바로 다시 보냄) — 먼저 저장된 쪽이 알림을 보내니 여긴 돌려주기만
      const duplicate = isClientMessageIdConflict(error) ? await this.sentBefore(actorId, dto.clientMessageId, owner, quoteInclude(actorId)) : null;
      if (duplicate) return this.presentSent(duplicate);
      throw error;
    }
    const message = await this.presentSent(created);
    // 채팅방을 열어 둔 팬·스타·소속사 화면에 바로 반영(푸시보다 먼저)
    void this.realtime.publish({ kind: 'artist-message', actorId });
    // 인용된 팬 — 인용이 가려지지 않았을 때만(정지·탈퇴·차단·신고 처리된 팬 메시지면 따로 알리지 않음)
    const quotedFanId = message.replyTo && !message.replyTo.hidden ? (created.replyTo?.fanUserId ?? null) : null;

    // 알림을 끈 팬은 푸시만 빼고 나머지(메시지 도착·lastArtistMessageAt)는 똑같이
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { actorId, cancelledAt: null, notificationsMuted: false },
      select: { userId: true },
    });
    const pushRecipients = activeSubscriptions.map((sub) => sub.userId);
    // 인용된 팬이 알림을 받는 구독자면 일반 알림 대신 "내 메시지에 답장했어요" 한 건만
    const notifyQuotedFan = !!quotedFanId && pushRecipients.includes(quotedFanId);
    await this.prisma.subscription.updateMany({
      where: { actorId, cancelledAt: null },
      data: { lastArtistMessageAt: new Date() },
    });

    // 푸시는 실패해도 메시지 발송 자체는 성공으로 처리 (best-effort). 카톡처럼 제목은 보낸 사람(대화방 이름),
    // 본문은 메시지 미리보기 — {{name}}은 받는 팬 본인 이름으로 치환, 텍스트가 없으면 미디어 종류 안내를
    // 받는 사람 언어로.
    const actor = await this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { chatDisplayName: true, kind: true, chatProfileImageUrl: true, officialProfileImageUrl: true } });
    // 커플방 알림은 "방 이름" 제목 + "보낸 배우: 내용"(카톡 단톡방처럼)
    const senderPrefix = actor.kind === ActorKind.COUPLE && message.sender ? `${message.sender.chatDisplayName}: ` : '';
    // 알림을 누르면 앱이 이 값으로 해당 채팅방(팬)/콘솔(소속사)로 이동
    const pushData = { type: 'NEW_MESSAGE', actorId, messageId: message.id };
    // 팬 알림엔 보낸 사람(대화방) 이름·프로필 사진 — 아이폰 알림 확장이 카톡처럼 사진이 있는 대화 알림으로 바꿈(2026-10-13).
    // 사진 주소는 임시 서명 URL(2시간) — 늦게 도착한 알림이면 사진만 빠지고 원래 알림 그대로
    // 대화방 사진을 "기본 이미지로" 돌려 둔 아티스트는 공식 사진으로(2026-10-15 실기기 — 사진이 없으면 아이폰이 앱 아이콘만 보여 줌)
    const senderImage = await this.mediaService.resolveImageUrl(actor.chatProfileImageUrl ?? actor.officialProfileImageUrl).catch(() => null);
    const fanPushData: Record<string, string> = { ...pushData, senderName: actor.chatDisplayName, ...(senderImage ? { senderImage } : {}) };
    // 여러 장 보내기의 앞쪽 것들 — 푸시 없이 끝(마지막 한 장이 묶음 알림 한 건을 보냄)
    if (dto.silent) return message;
    const preview = (locale: string | null, fanName?: string) => {
      if (!dto.body && dto.batchCount) return senderPrefix + pushStrings(locale).mediaBatch(dto.batchCount);
      if (!dto.body) return senderPrefix + pushStrings(locale).media[dto.mediaType];
      const text = fanName ? personalize(dto.body, fanName) : dto.body;
      return (senderPrefix + text).slice(0, PUSH_PREVIEW_LENGTH);
    };
    // 푸시는 기다리지 않음 — 구독자가 많으면(수천 명, FCM 500건씩) 스타 화면의 "보내기"가 몇 초씩 걸려서(2026-09-29 부하 테스트).
    // 메시지는 이미 저장·실시간 신호가 나갔고, 푸시 실패는 원래도 발송 성공으로 처리(best-effort)
    void this.pushService
      .sendToUsers(
        notifyQuotedFan ? pushRecipients.filter((userId) => userId !== quotedFanId) : pushRecipients,
        ({ locale, displayName }) => ({ title: actor.chatDisplayName, body: preview(locale, displayName) }),
        fanPushData,
        { withUnreadBadge: true },
      )
      .catch(() => {});
    // CP방에서 상대 아티스트 메시지에 답장했으면 그 아티스트에게 "○○님이 내 메시지에 답장했어요"(2026-10-15) — 누르면 스튜디오
    if (quotedArtistActorId) {
      const partner = await this.prisma.actor.findUnique({ where: { id: quotedArtistActorId }, select: { selfUserId: true } });
      const senderName = message.sender?.chatDisplayName ?? actor.chatDisplayName;
      if (partner?.selfUserId) {
        void this.pushService
          .sendToUser(
            partner.selfUserId,
            ({ locale }) => ({
              title: pushStrings(locale).quotedReplyTitle(senderName),
              body: (pushStrings(locale).quotedReplyPrefix + (dto.body ? dto.body : pushStrings(locale).media[dto.mediaType])).slice(0, PUSH_PREVIEW_LENGTH + 20),
            }),
            { ...pushData, type: 'QUOTED_REPLY', senderName },
          )
          .catch(() => {});
      }
    }
    if (notifyQuotedFan && quotedFanId) {
      void this.pushService
        .sendToUser(
          quotedFanId,
          ({ locale, displayName }) => ({
            title: pushStrings(locale).quotedReplyTitle(actor.chatDisplayName),
            // 아이폰 대화 알림은 제목을 보낸 사람 이름으로 바꿔서 "내 메시지에 답장"을 본문 앞에도(2026-10-13)
            body: (pushStrings(locale).quotedReplyPrefix + preview(locale, displayName)).slice(0, PUSH_PREVIEW_LENGTH + 20),
          }),
          { ...fanPushData, type: 'QUOTED_REPLY' },
          { withUnreadBadge: true },
        )
        .catch(() => {});
    }
    // 소속사 모니터링용 알림 — 팬 알림과 별개, 실패해도 발송 자체엔 영향 없음(모니터링은 원문 그대로라 치환 안 함).
    // 카톡처럼 제목 = 아티스트가 정한 이름, 본문 = 메시지, 아이폰은 프로필 사진(2026-10-14 사용자 요청 — 예전 "○○님이 새 메시지를 보냈어요")
    void this.pushService
      .notifyActorStaff(
        actorId,
        ({ locale }) => ({ title: actor.chatDisplayName, body: preview(locale) }),
        { ...pushData, senderName: actor.chatDisplayName, ...(senderImage ? { senderImage } : {}) },
        'notifyArtistMessages',
      )
      .catch(() => {});

    return message;
  }

  /** 방금 보낸(또는 다시 보내서 찾은) 스타 메시지를 보내기 응답 모양으로 — 인용 요약·임시 미디어 주소·보낸 배우 */
  private async presentSent(created: Prisma.MessageGetPayload<{ include: ReturnType<typeof quoteInclude> }>) {
    const [message] = await this.withSenders([await this.mediaService.withReadUrl(withQuote(created))]);
    return message;
  }

  // 콘솔 "구독자 답장 모아보기" — 스태프/배우 본인/관리자. messageId를 주면 그 스타 메시지에 달린 답장만
  // (스타 화면의 "메시지별 팬 답장")
  async listReplies(requesterId: string, actorId: string, messageId?: string, page: { limit?: number; before?: string } = {}) {
    await ensureCanViewActor(this.prisma, requesterId, actorId);
    const replies = await this.prisma.message.findMany({
      where: {
        actorId,
        senderType: MessageSenderType.FAN,
        fanUser: notBlockedIn(actorId),
        // 신고가 승인된(운영자가 문제 있다고 판단한) 답장은 스타·소속사 화면에서 뺌 — 예전엔 신고 처리만 되고 그대로 보였음
        reports: { none: { status: ReportStatus.RESOLVED } },
        ...(messageId ? { replyToMessageId: messageId } : {}),
      },
      include: { fanUser: { select: { id: true, nickname: true, deletedAt: true, profileImageUrl: true, statusMessage: true } } },
      // 최신 → 오래된 순. 같은 시각이면 id로 순서를 고정해야 나눠 받을 때 빠지거나 겹치지 않음
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(page.limit ? { take: page.limit } : {}),
      ...(page.before ? { cursor: { id: page.before }, skip: 1 } : {}),
    });
    // 스타·소속사에겐 실명일 수 있는 로그인 이름 대신 닉네임 + 같은 닉네임 구분용 태그만. 탈퇴한 팬은 null
    // (앱이 "탈퇴한 팬"으로 표시)
    // 팬 프로필 사진·상태메시지(2026-10-12)도 — 사진은 같은 팬이 여러 번 나와도 임시 주소를 한 번만 만듦
    const photoKeys = [...new Set(replies.map((reply) => reply.fanUser?.profileImageUrl).filter((key): key is string => !!key))];
    const photos = new Map(await Promise.all(photoKeys.map(async (key) => [key, await this.mediaService.resolveImageUrl(key)] as const)));
    // 팬이 회수한 답장(2026-10-14)은 자리만 — "회수된 메시지입니다"
    return replies.map(({ fanUser, ...reply }) => ({
      ...(reply.deletedAt ? asRetracted(reply) : reply),
      fanUser:
        fanUser && !fanUser.deletedAt
          ? {
              id: fanUser.id,
              nickname: fanUser.nickname,
              tag: fanTag(fanUser.id),
              profileImageUrl: fanUser.profileImageUrl ? (photos.get(fanUser.profileImageUrl) ?? null) : null,
              statusMessage: fanUser.statusMessage,
            }
          : null,
    }));
  }

  // 소속사 모니터링 — 배우가 실제로 보낸 메시지를 읽기 전용으로 확인(개인화 치환 없이 원문 그대로)
  async listBroadcasts(requesterId: string, actorId: string) {
    await ensureCanViewActor(this.prisma, requesterId, actorId);
    // 보는 사람이 아티스트 본인이면 자기 배우 id — CP방에서 내 메시지/상대 메시지 구분(상대 메시지엔 "답장", 2026-10-15)
    const selfActor = await this.prisma.actor.findFirst({ where: { selfUserId: requesterId }, select: { id: true } });
    const messages = await this.prisma.message.findMany({
      where: { actorId, senderType: MessageSenderType.ARTIST },
      orderBy: { createdAt: 'desc' },
      include: {
        ...quoteInclude(actorId),
        // 이 채널에서 차단된 팬의 답장은 세지 않음
        _count: {
          select: {
            replies: {
              where: {
                senderType: MessageSenderType.FAN,
                fanUser: notBlockedIn(actorId),
                reports: { none: { status: ReportStatus.RESOLVED } },
              },
            },
          },
        },
      },
    });
    // 미리보기 줄은 최근 메시지(삭제 안 된 것) 몇 개에만 — 답장이 아직 없어도 빈 배열로 줘서 앱이 "기다리는 중" 줄을 그림.
    // 그보다 오래된 메시지는 recentReplies 자체가 없음(앱은 숫자만)
    const previewTargets = messages.filter((m) => !m.deletedAt).slice(0, REPLY_PREVIEW_MESSAGES);
    const previews = await this.recentReplyPreviews(
      actorId,
      previewTargets.filter((m) => m._count.replies > 0).map((m) => m.id),
    );
    const previewIds = new Set(previewTargets.map((m) => m.id));
    return this.withSenders(
      await this.mediaService.withReadUrls(
        messages.map(({ _count, ...message }) => ({
          ...withQuote(message),
          replyCount: _count.replies,
          mine: !!selfActor && message.senderActorId === selfActor.id,
          ...(previewIds.has(message.id) ? { recentReplies: previews.get(message.id) ?? [] } : {}),
        })),
      ),
    );
  }

  /**
   * 메시지별 최근 팬 답장(오래된 것 → 최신 순) — 스타 화면에서 답장이 온 순서대로 한 줄씩 넘어가며 보이는 줄용. 눈에 잘 띄는
   * 자리라 답장 목록보다 엄격하게: 이 채널에서 차단됐거나 정지·탈퇴한 팬, 신고 처리된 답장은 뺌. 닉네임만(태그 없음).
   * 메시지마다 따로 조회(각각 인덱스 + LIMIT) — include의 take는 전체 답장을 읽은 뒤 자를 수 있어서.
   */
  private async recentReplyPreviews(actorId: string, messageIds: string[]) {
    const entries = await Promise.all(
      messageIds.map(async (messageId) => {
        const replies = await this.prisma.message.findMany({
          where: {
            replyToMessageId: messageId,
            actorId,
            senderType: MessageSenderType.FAN,
            deletedAt: null,
            fanUser: { ...notBlockedIn(actorId), status: UserStatus.ACTIVE, deletedAt: null },
            reports: { none: { status: ReportStatus.RESOLVED } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: REPLY_PREVIEW_PER_MESSAGE,
          select: { id: true, body: true, createdAt: true, fanUser: { select: { nickname: true } } },
        });
        const preview = replies.reverse().map(({ fanUser, body, ...reply }) => ({
          ...reply,
          nickname: fanUser?.nickname ?? null,
          body: (body ?? '').slice(0, REPLY_PREVIEW_LENGTH),
        }));
        return [messageId, preview] as const;
      }),
    );
    return new Map(entries);
  }

  /**
   * 스타의 보낸 메시지 삭제(보내기 취소) — 팬 화면에서 사라지고, 소속사 모니터링엔 "배우가 삭제한 메시지"로 남음.
   * 이미 보낸 푸시 알림은 되돌릴 수 없음. 첨부 파일은 신고가 걸려 있지 않으면 지움(신고 증거는 남김).
   */
  async deleteBroadcast(requesterId: string, actorId: string, messageId: string) {
    // 팬은 자기 답장만 회수(2026-10-14) — 같은 주소(DELETE …/messages/:id)를 씀
    const requester = await this.prisma.user.findUniqueOrThrow({ where: { id: requesterId }, select: { role: true } });
    if (requester.role === Role.USER) return this.retractReply(requesterId, actorId, messageId);
    // 소속사 직원도 자기 소속 아티스트 메시지를 대신 지울 수 있음(2026-10-12 사용자 결정 — 아티스트 사고 시 급히 내리기).
    // 팬 화면에선 아티스트가 지운 것과 똑같이 사라지고, 아티스트·소속사 화면엔 "소속사가 삭제한 메시지"로 남음
    const byStaff = requester.role === Role.AGENCY_STAFF;
    if (byStaff) await ensureCanViewActor(this.prisma, requesterId, actorId);
    else await ensureIsActorSelf(this.prisma, requesterId, actorId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, actorId, senderType: MessageSenderType.ARTIST },
      select: { id: true, deletedAt: true, mediaKey: true, thumbnailKey: true, _count: { select: { reports: true } } },
    });
    if (!message) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));
    if (message.deletedAt) return;
    const keepFile = message._count.reports > 0;
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        ...(byStaff ? { deletedByStaffId: requesterId } : {}),
        ...(keepFile ? {} : { mediaKey: null, thumbnailKey: null }),
      },
    });
    void this.realtime.publish({ kind: 'message-removed', actorId });
    if (!keepFile) {
      await this.mediaService.deleteQuietly(message.mediaKey);
      await this.mediaService.deleteQuietly(message.thumbnailKey);
    }
  }

  /**
   * 팬이 자기 답장 회수(2026-10-14 사용자 결정) — 시간 제한 없음. 아티스트·소속사·내 화면엔 "회수된 메시지입니다"로 자리만 남고 원본은 DB에
   * 그대로(이미 신고됐거나 나중에 신고되면 운영자가 확인). 하루 답장 개수는 돌려주지 않음(보내고 회수하고 다시 보내기 반복 방지 —
   * replyTarget이 지운 것도 셈)
   */
  async retractReply(userId: string, actorId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, actorId, senderType: MessageSenderType.FAN, fanUserId: userId },
      select: { id: true, deletedAt: true },
    });
    if (!message) throw new NotFoundException(appError('MESSAGE_NOT_FOUND'));
    if (message.deletedAt) return;
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    void this.realtime.publish({ kind: 'message-removed', actorId });
  }
}
