import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageSenderType, Role, UserStatus, type ReportCategory } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { appError } from '../common/i18n/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import { escapeLike } from '../common/utils/escape-like.js';
import { startOfTodayInZone } from '../common/utils/stats-time.js';

interface SanctionReason {
  category: ReportCategory;
  note?: string;
}

const LIST_SELECT = {
  id: true,
  displayName: true,
  nickname: true,
  email: true,
  role: true,
  status: true,
  suspendedUntil: true,
  bannedAt: true,
  sanctionCategory: true,
  sanctionNote: true,
  // 팬 프로필(2026-10-12) — 부적절하면 운영자가 지움(사진은 저장소 키라 "있는지"만 판단용)
  statusMessage: true,
  profileImageUrl: true,
  createdAt: true,
  deletedAt: true,
  // 접속 확인(2026-10-14) — 마지막 접속(한 시간 단위)과 마지막으로 쓴 기기
  lastActiveAt: true,
  accessLogs: {
    select: { platform: true, deviceModel: true, osVersion: true, appVersion: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  agency: { select: { id: true, name: true } },
  actorSelf: { select: { id: true, legalName: true } },
} as const;

const ACCESS_LOG_PAGE = 200;
/** 팬 한 명 기준 보기 — 답장·신고·작업 기록 각각 최신순 최대 줄 수 */
const ACTIVITY_PAGE = 50;
/** 회원 목록 한 쪽 인원 */
export const USER_PAGE_SIZE = 50;

/** 회원 목록 맨 위 요약 카드(2026-10-25) — 오늘 가입(태국 날짜)·지금 열린 방이 있음·정지/영구차단 */
export type UserListFilter = 'today' | 'subscribed' | 'sanctioned';
const filterWhere = (filter: UserListFilter, now = new Date()): Prisma.UserWhereInput =>
  filter === 'today'
    ? { createdAt: { gte: startOfTodayInZone(now) } }
    : filter === 'subscribed'
      ? { subscriptions: { some: { cancelledAt: null } } }
      : { status: { in: [UserStatus.SUSPENDED, UserStatus.BANNED] } };

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 회원 목록(2026-10-20: 나눠 불러오기 + 역할별 인원수, 2026-10-25: 요약 카드) — 한 번에 PAGE_SIZE명, page는 1부터.
   * counts는 검색어 + 요약 카드 조건을 건 역할별 인원(탭 옆 숫자), summary는 검색어만 건 요약 카드 숫자(전체·오늘 가입·구독 중·제재 중),
   * total은 지금 조건 전체 인원(쪽 수 계산용). 줄마다 지금 열린 방 개수(activeRoomCount).
   */
  async findAll(query?: string, role?: Role, sort?: 'recent', page = 1, filter?: UserListFilter) {
    const search: Prisma.UserWhereInput = query
      ? {
          OR: [
            { displayName: { contains: escapeLike(query), mode: 'insensitive' } },
            { nickname: { contains: escapeLike(query), mode: 'insensitive' } },
            { email: { contains: escapeLike(query), mode: 'insensitive' } },
          ],
        }
      : {};
    const filtered: Prisma.UserWhereInput = filter ? { AND: [search, filterWhere(filter)] } : search;
    const where: Prisma.UserWhereInput = { ...filtered, ...(role ? { role } : {}) };
    const now = new Date();
    const [rows, byRole, today, subscribed, sanctioned] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { ...LIST_SELECT, _count: { select: { subscriptions: { where: { cancelledAt: null } } } } },
        // 최근 접속순이면 한 번도 접속 안 한 계정은 맨 뒤
        orderBy: sort === 'recent' ? [{ lastActiveAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }] : { createdAt: 'desc' },
        skip: (Math.max(1, page) - 1) * USER_PAGE_SIZE,
        take: USER_PAGE_SIZE,
      }),
      this.prisma.user.groupBy({ by: ['role'], where: filtered, _count: { _all: true } }),
      ...(['today', 'subscribed', 'sanctioned'] as const).map((key) => this.prisma.user.count({ where: { AND: [search, filterWhere(key, now)] } })),
    ]);
    const counts: Record<Role | 'ALL', number> = { ALL: 0, USER: 0, ACTOR: 0, AGENCY_STAFF: 0, ADMIN: 0 };
    for (const row of byRole) {
      counts[row.role] = row._count._all;
      counts.ALL += row._count._all;
    }
    const all = filter ? await this.prisma.user.count({ where: search }) : counts.ALL;
    const items = rows.map(({ _count, ...user }) => ({ ...user, activeRoomCount: _count.subscriptions }));
    return {
      items,
      counts,
      summary: { all, today, subscribed, sanctioned },
      total: role ? counts[role] : counts.ALL,
      page: Math.max(1, page),
      pageSize: USER_PAGE_SIZE,
    };
  }

  /** 회원 한 명(2026-10-20, 회원 상세 화면·신고에서 바로 제재) */
  async findOne(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: LIST_SELECT });
    if (!user) throw new NotFoundException(appError('USER_NOT_FOUND'));
    return user;
  }

  /**
   * 회원 한 명의 구독·결제·환불(2026-10-20 — "결제했는데 안 열려요" 같은 문의 대응). 방 이용권(Subscription), 구매(개인·묶음, 스토어·자동 갱신),
   * 결제 건(최근 100건, 환불 여부), 환불 요청.
   */
  async billing(userId: string) {
    const [rooms, purchases, charges, refunds] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: { actorId: true, startedAt: true, cancelledAt: true, actor: { select: { legalName: true, chatDisplayName: true, kind: true } } },
      }),
      this.prisma.purchase.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          priceCents: true,
          startedAt: true,
          cancelledAt: true,
          iapPlatform: true,
          iapExpiresAt: true,
          willRenew: true,
          actor: { select: { id: true, legalName: true } },
          bundle: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchaseCharge.findMany({
        where: { purchase: { userId } },
        orderBy: { chargedAt: 'desc' },
        take: 100,
        select: { id: true, productName: true, amountCents: true, chargedAt: true, periodEnd: true, source: true, refundedAt: true, storeAmountMilli: true, storeCurrency: true, kind: true },
      }),
      this.prisma.refundRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reason: true, status: true, source: true, createdAt: true, charge: { select: { productName: true, amountCents: true, refundedAt: true } } },
      }),
    ]);
    return { rooms, purchases, charges, refunds };
  }

  /**
   * 팬 한 명 기준 보기(2026-10-22) — "왜 답장이 안 보내져요?" 같은 문의에 한 화면에서 답하려고. 최근 답장(어느 방·언제·내용·회수/가림),
   * 이 팬의 답장이 받은 신고·이 팬이 한 신고, 아티스트·소속사에게 차단당한 방(ActorFanBlock), 운영자 작업 기록(제재·프로필 지움·역할 등).
   */
  async activity(userId: string) {
    const [replies, reportsReceived, reportsFiled, blocks, actions] = await Promise.all([
      this.prisma.message.findMany({
        where: { fanUserId: userId, senderType: MessageSenderType.FAN },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_PAGE,
        select: {
          id: true,
          body: true,
          mediaType: true,
          createdAt: true,
          deletedAt: true,
          deletedByAdmin: true,
          deletedByStaffId: true,
          actor: { select: { id: true, legalName: true, chatDisplayName: true, kind: true } },
          _count: { select: { reports: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { message: { fanUserId: userId } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_PAGE,
        select: {
          id: true,
          category: true,
          reason: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          message: { select: { id: true, body: true, actor: { select: { legalName: true } } } },
        },
      }),
      this.prisma.report.findMany({
        where: { reportedById: userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_PAGE,
        select: {
          id: true,
          category: true,
          reason: true,
          status: true,
          createdAt: true,
          message: { select: { id: true, senderType: true, body: true, actor: { select: { legalName: true } } } },
        },
      }),
      this.prisma.actorFanBlock.findMany({
        where: { fanUserId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          createdAt: true,
          actor: { select: { id: true, legalName: true } },
          blockedBy: { select: { displayName: true, role: true } },
          message: { select: { body: true, createdAt: true } },
        },
      }),
      this.prisma.adminAction.findMany({
        where: { targetType: 'USER', targetId: userId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_PAGE,
        select: { id: true, action: true, detail: true, createdAt: true, admin: { select: { displayName: true } } },
      }),
    ]);
    return {
      replies: replies.map(({ _count, ...reply }) => ({ ...reply, reportCount: _count.reports })),
      reportsReceived,
      reportsFiled,
      blocks,
      actions,
    };
  }

  /** 회원 한 명의 접속 기록(최근 3개월, 최신순 최대 200줄) — 로그인·접속 시각, 기기, 앱 버전, IP */
  async accessLogs(userId: string) {
    return this.prisma.accessLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: ACCESS_LOG_PAGE,
      select: { id: true, kind: true, method: true, platform: true, deviceModel: true, osVersion: true, appVersion: true, ip: true, createdAt: true },
    });
  }

  // 정지·영구차단은 사유(분류 + 내부 메모)를 같이 남기고 작업 기록에도 — 당사자에겐 로그인 때 분류가 번역돼서 안내됨
  async suspend(adminId: string, userId: string, until: Date, reason: SanctionReason) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED, suspendedUntil: until, bannedAt: null, sanctionCategory: reason.category, sanctionNote: reason.note?.trim() || null },
      select: LIST_SELECT,
    });
    await this.audit.record(adminId, 'USER_SUSPEND', 'USER', userId, { until: until.toISOString(), ...reason });
    return user;
  }

  async ban(adminId: string, userId: string, reason: SanctionReason) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.BANNED, bannedAt: new Date(), suspendedUntil: null, sanctionCategory: reason.category, sanctionNote: reason.note?.trim() || null },
      select: LIST_SELECT,
    });
    await this.audit.record(adminId, 'USER_BAN', 'USER', userId, { ...reason });
    return user;
  }

  async reactivate(adminId: string, userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, suspendedUntil: null, bannedAt: null, sanctionCategory: null, sanctionNote: null },
      select: LIST_SELECT,
    });
    await this.audit.record(adminId, 'USER_REACTIVATE', 'USER', userId);
    return user;
  }

  /** 팬 프로필 사진·상태메시지 지우기(2026-10-12) — 신고·민원 대응. 사진 파일은 하루 뒤 정리 작업이 지움 */
  async clearProfile(adminId: string, userId: string) {
    const before = await this.prisma.user.findUnique({ where: { id: userId }, select: { statusMessage: true } });
    if (!before) throw new NotFoundException(appError('USER_NOT_FOUND'));
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl: null, statusMessage: null },
      select: LIST_SELECT,
    });
    await this.audit.record(adminId, 'USER_PROFILE_CLEAR', 'USER', userId, { statusMessage: before.statusMessage });
    return user;
  }

  /**
   * 역할 변경 — 스타·소속사 직원도 일반 가입(소셜 로그인)으로 들어온 뒤 운영자가 여기서 바꿈.
   * - 운영자 계정은 바꾸지 않고, 운영자로 올리는 것도 불가(DTO에서 막음)
   * - 구독 중인 팬 계정은 배우/직원으로 못 바꿈(결제 중인 팬 계정이 관리 권한을 갖는 걸 막음)
   * - 역할이 바뀌면 이전 역할에 딸린 연결(소속사 배정, 배우 본인 연결)은 끊음
   */
  async changeRole(adminId: string, userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true, _count: { select: { subscriptions: { where: { cancelledAt: null } } } } },
    });
    if (!user) throw new NotFoundException(appError('USER_NOT_FOUND'));
    if (user.deletedAt) throw new BadRequestException(appError('ACCOUNT_DELETED'));
    if (user.role === Role.ADMIN) throw new BadRequestException(appError('ADMIN_ROLE_LOCKED'));
    if (user.role === role) return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: LIST_SELECT });
    if (role !== Role.USER && user._count.subscriptions > 0) {
      throw new BadRequestException(appError('SUBSCRIBED_FAN_ROLE_CHANGE'));
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (user.role === Role.ACTOR) await tx.actor.updateMany({ where: { selfUserId: userId }, data: { selfUserId: null } });
      return tx.user.update({
        where: { id: userId },
        data: { role, agencyId: role === Role.AGENCY_STAFF ? undefined : null },
        select: LIST_SELECT,
      });
    });
    await this.audit.record(adminId, 'USER_ROLE', 'USER', userId, { from: user.role, to: role });
    return updated;
  }
}
