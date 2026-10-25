import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isStorageKey, profileImagePrefix } from '../storage/media-policy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ensureCanViewActor, ensureIsActorSelf, viewableActorsWhere } from '../common/authorization/actor-access.js';
import { normalizeNickname } from '../common/nickname/nickname.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { ActorKind, ArtistGender, MessageSenderType, Role } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MediaService } from '../storage/media.service.js';
import { appError } from '../common/i18n/app-error.js';
import { cleanStatusMessage } from '../common/status-message/status-message.js';
import { escapeLike } from '../common/utils/escape-like.js';
import { withFirstOfficialAsChat } from './profile-images.js';
import { ReleaseService } from '../releases/release.service.js';

// legalName/officialProfileImageUrl는 탐색 화면(공식 프로필, 운영자가 관리)에, chatDisplayName(배우가 직접 정하는
// 닉네임)/chatProfileImageUrl는 채팅방 안에서 씀 — 어느 쪽을 보여줄지는 클라이언트가 화면 맥락에 맞게 고름
const LIST_SELECT = {
  id: true,
  legalName: true,
  officialProfileImageUrl: true,
  chatDisplayName: true,
  chatProfileImageUrl: true,
  // 토피룸 배경 사진(2026-10-14) — 팬 토피룸 뒤에 깔림
  chatBackgroundUrl: true,
  // 상태메시지(2026-10-25) — 토피룸 프로필 카드 한 줄, 없으면 null
  statusMessage: true,
  monthlyPriceCents: true,
  // 개인 구독 스토어 상품 ID(없으면 아직 스토어 결제 불가 — 앱은 테스트 구독만)
  storeProductId: true,
  // Discover의 "NEW" 표시용
  createdAt: true,
  // 둘러보기 성별 줄(커플방·지정 안 함은 null)
  gender: true,
  retiredAt: true,
  // 활동 종료 예정(2026-10-20) — 있으면 팬 화면 "N월 N일 활동 종료 예정", 새 구독 불가
  retireAt: true,
  // 공개 예정(2026-10-19) — 미래 시각이면 팬 화면은 "곧 공개" 카드 + 알림 받기(구독 불가)
  releaseAt: true,
  // 소속사는 팬에게도 공개(소속사별 목록/검색) — 무소속이면 null
  agency: { select: { id: true, name: true, logoUrl: true } },
  // 1인 방(SOLO) / 커플방(COUPLE, 2026-09-29) — 커플방이면 멤버 배우 2명
  kind: true,
  coupleMembers: {
    select: {
      // 멤버 소속사 이름 — CP방은 소속사가 따로 없어서 카드에 멤버 소속사를 보여 줌(2026-10-16)
      member: {
        select: {
          id: true,
          legalName: true,
          chatDisplayName: true,
          officialProfileImageUrl: true,
          chatProfileImageUrl: true,
          // 커플방 카드는 멤버별 상태메시지(2026-10-25)
          statusMessage: true,
          retiredAt: true,
          retireAt: true,
          // id는 운영자 대시보드의 소속사 필터(CP방은 멤버 소속사로, 2026-10-20)
          agency: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

// 커플방 중 멤버 배우가 활동 종료한 방은 팬 목록에서 숨김(방 자체의 retiredAt과 같은 취급)
const NO_RETIRED_MEMBER: Prisma.ActorWhereInput = { coupleMembers: { none: { member: { retiredAt: { not: null } } } } };

@Injectable()
export class ActorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly moderation: ModerationService,
    private readonly releases: ReleaseService,
  ) {}

  // q는 배우 이름뿐 아니라 소속사 이름에도 매칭 — "GMMTV"로 검색하면 소속 배우가 다 나오게
  async findAll(query?: string, agencyId?: string, sort?: 'trending' | 'new', kind: ActorKind | 'ALL' = ActorKind.SOLO, gender?: ArtistGender) {
    // 활동 종료한 아티스트는 둘러보기·검색에서 숨김(프로필 링크로 들어오면 "활동 종료" 안내). 기본은 1인 아티스트만 —
    // 커플방은 kind=COUPLE로 따로(둘러보기의 CP 줄), ALL은 둘 다(새로 온 아티스트·CP)
    const where: Prisma.ActorWhereInput = { retiredAt: null, ...(kind === 'ALL' ? {} : { kind }), ...NO_RETIRED_MEMBER };
    if (agencyId) where.agencyId = agencyId;
    if (gender) where.gender = gender;
    if (query) {
      where.OR = [
        { legalName: { contains: escapeLike(query), mode: 'insensitive' } },
        // 닉네임(채팅방 이름)으로도 — 팬은 공식 이름보다 닉네임으로 기억하는 경우가 많음(2026-10-12 실기기: "캐러멜" 검색이 안 됐음)
        { chatDisplayName: { contains: escapeLike(query), mode: 'insensitive' } },
        { agency: { name: { contains: escapeLike(query), mode: 'insensitive' } } },
        // CP방은 자기 소속사가 없어서 멤버 소속사로(2026-10-20 — 소속사 이름 검색에 CP방이 빠졌음, 둘러보기 카드도 멤버 소속사를 보여 줌)
        { coupleMembers: { some: { member: { agency: { name: { contains: escapeLike(query), mode: 'insensitive' } } } } } },
      ];
    }
    const actors = await this.prisma.actor.findMany({
      where,
      select: LIST_SELECT,
      orderBy:
        sort === 'trending'
          ? [{ subscriptions: { _count: 'desc' } }, { legalName: 'asc' }]
          : sort === 'new'
            ? [{ createdAt: 'desc' }]
            : { legalName: 'asc' },
    });
    // "새로 온" 줄은 공개 시각(없으면 등록 시각) 기준 — 미리 등록해 둔 아티스트가 공개될 때 맨 앞에 오게(2026-10-19)
    if (sort === 'new') actors.sort((a, b) => (b.releaseAt ?? b.createdAt).getTime() - (a.releaseAt ?? a.createdAt).getTime());
    return Promise.all(actors.map((actor) => this.withImageUrls(actor)));
  }

  /** 이 배우가 멤버인 커플방(배우 프로필의 "커플방") — 활동 중인 것만 */
  async couplesOf(actorId: string) {
    const rows = await this.prisma.actor.findMany({
      where: { kind: ActorKind.COUPLE, retiredAt: null, coupleMembers: { some: { memberId: actorId } }, ...NO_RETIRED_MEMBER },
      select: LIST_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((row) => this.withImageUrls(row)));
  }

  async findOne(id: string) {
    const actor = await this.prisma.actor.findUnique({ where: { id }, select: LIST_SELECT });
    if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
    return this.withImageUrls(actor);
  }

  // 콘솔 진입점 — 스태프는 자기 소속사 배우 전원, 배우 본인은 자기 자신, ADMIN은 전체
  async findMine(userId: string) {
    const requester = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const actors = await this.prisma.actor.findMany({
      where: requester.role === Role.ADMIN ? undefined : viewableActorsWhere(requester),
      select: LIST_SELECT,
      orderBy: { legalName: 'asc' },
    });
    const ids = actors.map((actor) => actor.id);
    const [last, lastMessages, watchCounts, subscribers] = await Promise.all([
      this.lastBroadcastMap(ids),
      this.lastMessageMap(ids),
      this.releases.actorWatchCounts(ids),
      this.prisma.subscription.groupBy({ by: ['actorId'], where: { actorId: { in: ids }, cancelledAt: null }, _count: { _all: true } }),
    ]);
    const subscriberCounts = new Map(subscribers.map((row) => [row.actorId, row._count._all]));
    // 마지막 스타 메시지 시각 — 소속사 목록의 "N일째 미발송" 표시(2026-09-29). lastMessage는 토피룸 목록 미리보기(2026-10-14, 카톡 대화방 목록처럼)
    return Promise.all(
      actors.map(async (actor) => ({
        ...(await this.withImageUrls(actor)),
        lastBroadcastAt: last.get(actor.id) ?? null,
        lastMessage: lastMessages.get(actor.id) ?? null,
        // "곧 공개" 알림 신청 수(2026-10-19) — 소속사에 보여 줄 사전 수요 숫자. 공개 후에도 남음
        releaseWatchCount: watchCounts.get(actor.id) ?? 0,
        // 지금 구독 중인 수(2026-10-20) — 운영자·소속사 토피룸 모니터링 목록의 운영 정보 줄
        subscriberCount: subscriberCounts.get(actor.id) ?? 0,
      })),
    );
  }

  /** 방별 마지막 스타 메시지(지운·회수한 것 제외) — 스튜디오·소속사 토피룸 목록의 미리보기 줄 */
  private async lastMessageMap(actorIds: string[]) {
    if (actorIds.length === 0) return new Map<string, { body: string | null; mediaType: string; createdAt: Date }>();
    const rows = await this.prisma.message.findMany({
      where: { actorId: { in: actorIds }, senderType: MessageSenderType.ARTIST, deletedAt: null },
      distinct: ['actorId'],
      orderBy: [{ actorId: 'asc' }, { createdAt: 'desc' }],
      select: { actorId: true, body: true, mediaType: true, createdAt: true },
    });
    return new Map(rows.map(({ actorId, ...message }) => [actorId, message]));
  }

  /** 방별 마지막 스타 메시지 시각(지운 메시지 제외) */
  async lastBroadcastMap(actorIds: string[]): Promise<Map<string, Date | null>> {
    if (actorIds.length === 0) return new Map();
    const rows = await this.prisma.message.groupBy({
      by: ['actorId'],
      where: { actorId: { in: actorIds }, senderType: MessageSenderType.ARTIST, deletedAt: null },
      _max: { createdAt: true },
    });
    return new Map(rows.map((row) => [row.actorId, row._max.createdAt]));
  }

  // 이미지 필드에 저장소 키가 들어 있으면 임시 조회 URL로 바꿔서 내려줌(MediaService.resolveImageUrl)
  async withImageUrls<
    T extends {
      officialProfileImageUrl: string | null;
      chatProfileImageUrl: string | null;
      chatBackgroundUrl?: string | null;
      agency: { logoUrl: string | null } | null;
      coupleMembers?: { member: { officialProfileImageUrl: string | null; chatProfileImageUrl: string | null } }[];
    },
  >(actor: T): Promise<T> {
    const [officialProfileImageUrl, chatProfileImageUrl, chatBackgroundUrl, logoUrl, coupleMembers] = await Promise.all([
      this.media.resolveImageUrl(actor.officialProfileImageUrl),
      this.media.resolveImageUrl(actor.chatProfileImageUrl),
      actor.chatBackgroundUrl === undefined ? undefined : this.media.resolveImageUrl(actor.chatBackgroundUrl),
      this.media.resolveImageUrl(actor.agency?.logoUrl ?? null),
      // 커플방 멤버 사진도 같은 방식으로
      actor.coupleMembers &&
        Promise.all(
          actor.coupleMembers.map(async ({ member }) => ({
            member: {
              ...member,
              officialProfileImageUrl: await this.media.resolveImageUrl(member.officialProfileImageUrl),
              chatProfileImageUrl: await this.media.resolveImageUrl(member.chatProfileImageUrl),
            },
          })),
        ),
    ]);
    return {
      ...actor,
      officialProfileImageUrl,
      chatProfileImageUrl,
      ...(chatBackgroundUrl !== undefined ? { chatBackgroundUrl } : {}),
      agency: actor.agency && { ...actor.agency, logoUrl },
      ...(coupleMembers ? { coupleMembers } : {}),
    };
  }

  // ── 프로필 사진 ─────────────────────────────────────────
  // 대화방 사진은 배우 본인·소속사 직원도 메신저 프로필처럼 바꿀 수 있음(스키마 주석 참고), 공식 사진은 운영자만
  // (공식 사진·이름은 사칭 방지를 위해 운영자가 확인하는 값). 권한 확인은 호출하는 쪽에서.

  createProfileUpload(actorId: string, contentType: string, sizeBytes: number) {
    return this.media.createUploadAt(profileImagePrefix('ACTOR', actorId), 'PHOTO', contentType, sizeBytes);
  }

  /** 값: 업로드로 받은 키, null(삭제), undefined(그대로). 바뀐 이전 파일은 다른 칸에서 안 쓰면 지움 */
  async updateImages(actorId: string, changes: { official?: string | null; chat?: string | null }) {
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
      select: { officialProfileImageUrl: true, chatProfileImageUrl: true },
    });
    if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));

    changes = withFirstOfficialAsChat(actor, changes);
    const data: Prisma.ActorUpdateInput = {};
    const replaced: (string | null)[] = [];
    if (changes.official !== undefined) {
      data.officialProfileImageUrl = await this.checkImageKey(actorId, changes.official);
      replaced.push(actor.officialProfileImageUrl);
    }
    if (changes.chat !== undefined) {
      data.chatProfileImageUrl = await this.checkImageKey(actorId, changes.chat);
      replaced.push(actor.chatProfileImageUrl);
    }
    const updated = await this.prisma.actor.update({
      where: { id: actorId },
      data,
      select: { officialProfileImageUrl: true, chatProfileImageUrl: true },
    });
    const stillUsed = new Set([updated.officialProfileImageUrl, updated.chatProfileImageUrl]);
    for (const old of replaced) {
      if (isStorageKey(old) && !stillUsed.has(old)) await this.media.deleteQuietly(old);
    }
  }

  private async checkImageKey(actorId: string, key: string | null): Promise<string | null> {
    if (key === null) return null;
    await this.media.verifyAt(profileImagePrefix('ACTOR', actorId), 'PHOTO', key);
    return key;
  }

  /** 배우 본인·소속사 직원의 대화방 사진 변경 */
  async createChatProfileUpload(userId: string, actorId: string, contentType: string, sizeBytes: number) {
    await ensureCanViewActor(this.prisma, userId, actorId);
    return this.createProfileUpload(actorId, contentType, sizeBytes);
  }

  async setChatProfileImage(userId: string, actorId: string, key: string | null) {
    await ensureCanViewActor(this.prisma, userId, actorId);
    await this.updateImages(actorId, { chat: key });
    return this.findOne(actorId);
  }

  /**
   * 토피룸 배경 사진(2026-10-14 사용자 결정, 1차) — 대화방 사진과 같은 권한(아티스트 본인·소속사·운영자), 같은 업로드 자리.
   * null이면 기본 배경. 바뀐 이전 파일은 다른 칸에서 안 쓰면 지움
   */
  async setChatBackground(userId: string, actorId: string, key: string | null) {
    await ensureCanViewActor(this.prisma, userId, actorId);
    const actor = await this.prisma.actor.findUniqueOrThrow({
      where: { id: actorId },
      select: { chatBackgroundUrl: true, officialProfileImageUrl: true, chatProfileImageUrl: true },
    });
    const next = await this.checkImageKey(actorId, key);
    await this.prisma.actor.update({ where: { id: actorId }, data: { chatBackgroundUrl: next } });
    const old = actor.chatBackgroundUrl;
    if (isStorageKey(old) && old !== next && old !== actor.officialProfileImageUrl && old !== actor.chatProfileImageUrl) {
      await this.media.deleteQuietly(old);
    }
    return this.findOne(actorId);
  }

  /**
   * 배우 닉네임(= 채팅방에 보이는 이름, 컬럼명은 chatDisplayName) — 배우 본인이 자유롭게 바꿈(변경 주기 제한 없음).
   * 팬 닉네임과 같은 기본 규칙(길이·보이지 않는 문자·예약어·금칙어) + 다른 배우와 같은 닉네임 금지(팬 혼동 방지).
   */
  async updateNickname(userId: string, actorId: string, raw: string) {
    await ensureIsActorSelf(this.prisma, userId, actorId);
    const nickname = normalizeNickname(raw);
    await this.moderation.assertNoBannedWords(nickname).catch(() => {
      throw new BadRequestException(appError('NICKNAME_INAPPROPRIATE'));
    });
    const clash = await this.prisma.actor.findFirst({
      where: {
        id: { not: actorId },
        OR: [
          { chatDisplayName: { equals: nickname, mode: 'insensitive' } },
          { legalName: { equals: nickname, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(appError('ACTOR_NAME_TAKEN'));
    await this.prisma.actor.update({ where: { id: actorId }, data: { chatDisplayName: nickname } });
    return this.findOne(actorId);
  }

  /**
   * 상태메시지(2026-10-25 사용자 결정) — 아티스트 본인만(닉네임과 같은 권한, 소속사는 대신 못 씀). 빈 값이면 지움.
   * 커플방 id로 부르면 그 방의 "내" 멤버 배우 값을 바꿈(멤버별 상태메시지 — 개인방·다른 CP방 카드에도 같이 보임).
   * 운영자는 여기서 못 쓰고 운영자 화면에서 지우기만(작업 기록).
   */
  async updateStatusMessage(userId: string, actorId: string, raw: string) {
    const selfId = await ensureIsActorSelf(this.prisma, userId, actorId);
    if (!selfId) throw new ForbiddenException(appError('ACTOR_SELF_ONLY'));
    const statusMessage = await cleanStatusMessage(raw, this.moderation);
    await this.prisma.actor.update({ where: { id: selfId }, data: { statusMessage } });
    return this.findOne(actorId);
  }
}
