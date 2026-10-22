import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChargeSource, MessageSenderType, RefundRequestStatus } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { appError } from '../common/i18n/app-error.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
import { IapVerificationService } from './iap-verification.service.js';
import { ChargeLedgerService } from '../settlements/charge-ledger.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// 애플은 우리가 환불할 수 없음 — 팬이 직접 애플에 요청하는 공식 페이지
export const APPLE_REFUND_URL = 'https://reportaproblem.apple.com/';

/** 환불 사유 — 스타 미발송(STAR_IDLE), 배우 활동 종료·입대(ACTOR_RETIRED) */
export type RefundReason = 'STAR_IDLE' | 'ACTOR_RETIRED';

/** 애플 안내 뒤 이만큼(일) 지나도 환불이 안 되면 운영자 "환불 처리 대기"(2026-10-22 잠정 — STATUS 정책 표, APPLE_REFUND_WAIT_DAYS로 바꿈) */
export const APPLE_REFUND_WAIT_DAYS = 3;

/** 환불 처리 대기 조건 — 애플 안내함 + 결제가 아직 환불로 안 바뀜 + 안내한 지 waitDays 넘음 + 운영자가 아직 "확인함" 안 누름 */
export function storeRefundWaitingWhere(now: Date, waitDays: number): Prisma.RefundRequestWhereInput {
  return {
    status: RefundRequestStatus.STORE_GUIDED,
    checkedAt: null,
    createdAt: { lte: new Date(now.getTime() - waitDays * DAY_MS) },
    charge: { refundedAt: null },
  };
}

const CHARGE_SELECT = {
  id: true,
  productName: true,
  amountCents: true,
  currency: true,
  chargedAt: true,
  periodEnd: true,
  source: true,
  storeTransactionId: true,
  allocations: { select: { roomId: true } },
  refundRequests: { select: { reason: true, status: true } },
} as const;
type ChargeRow = Prisma.PurchaseChargeGetPayload<{ select: typeof CHARGE_SELECT }>;

export interface RefundCandidate {
  chargeId: string;
  reason: RefundReason;
  productName: string;
  amountCents: number;
  currency: string;
  chargedAt: string;
  periodEnd: string;
  /** 활동 종료 사유면 종료된 때 */
  endedAt: string | null;
  /** 이때까지 요청 가능 */
  deadline: string;
  source: ChargeSource;
  /** 애플 결제를 이미 안내받았으면 STORE_GUIDED */
  requested: RefundRequestStatus | null;
}

/**
 * 팬 환불 요청(2026-09-29, 버블 방식 참고 — STATUS "출시 전 확정할 정책"). 결제 한 건 단위, 전액만(스토어가 부분 환불을 못 해서).
 * - STAR_IDLE(스타 미발송): 이용 기간(chargedAt ~ periodEnd) 동안 그 결제로 열린 방(묶음이면 모든 방)에 스타 메시지가 하나도 없으면, 기간이 끝난 뒤
 *   REFUND_REQUEST_DAYS(기본 7)일 안. 팬 답장 여부는 안 따짐. 지운 메시지는 안 셈.
 * - ACTOR_RETIRED(활동 종료·입대): 그 결제로 열린 방이 모두 활동 종료됐고(커플방은 멤버 한 명만 종료돼도 방 종료, 묶음은 모든 방), 마지막 종료가
 *   결제 후 RETIRE_REFUND_DAYS(기본 14)일 안(결제 전에 이미 종료된 방에 갱신 결제가 된 경우도 포함) → 종료 때부터 기간이 끝난 뒤 7일까지.
 *   입대는 운영자가 "활동 종료"로 처리하고 전역하면 "재개"(재개하면 대상에서 빠짐).
 *   단, 종료 예정 알림(retireNoticedAt)이 나간 뒤 종료 전에 된 결제는 대상 아님(2026-10-21 사용자 결정 B안 — 알림을 받고도 결제한 것.
 *   7일 청약철회는 별도로 그대로). 이미 종료된 뒤 된 갱신 결제는 알림과 상관없이 대상.
 * 환불: 테스트 결제는 바로 기록, 구글은 우리가 API로 그 결제만 환불(지금 이용 중인 기간·자동 갱신은 그대로), 애플은 애플 환불 페이지 안내.
 * 환불된 결제는 정산에서 자동으로 빠짐(마감한 달이면 다음 달 조정).
 */
@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly iap: IapVerificationService,
    private readonly ledger: ChargeLedgerService,
    // 운영자 알림(2026-10-20) — 단위 테스트에선 없을 수 있음
    private readonly alerts?: AdminAlertService,
  ) {}

  private days(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  get requestDays(): number {
    return this.days('REFUND_REQUEST_DAYS', this.days('IDLE_REFUND_REQUEST_DAYS', 7));
  }

  get retireRefundDays(): number {
    return this.days('RETIRE_REFUND_DAYS', 14);
  }

  /** 지금 환불을 요청할 수 있는 내 결제들(결제 하나에 사유 하나 — 둘 다 맞으면 활동 종료) */
  async candidates(userId: string, now = new Date()): Promise<RefundCandidate[]> {
    const requestMs = this.requestDays * DAY_MS;
    const charges = await this.prisma.purchaseCharge.findMany({
      where: { refundedAt: null, purchase: { userId }, periodEnd: { gt: new Date(now.getTime() - requestMs) }, chargedAt: { lte: now } },
      select: CHARGE_SELECT,
      orderBy: { periodEnd: 'desc' },
    });
    const result: RefundCandidate[] = [];
    for (const charge of charges) {
      const rooms = [...new Set(charge.allocations.map((allocation) => allocation.roomId))];
      // 방 정보가 없는 결제는 판단할 수 없어서 대상 아님
      if (rooms.length === 0) continue;
      const deadline = new Date(charge.periodEnd.getTime() + requestMs);
      const ended = await this.roomsEnded(rooms);
      const endedAt = ended?.at;
      const paidAfterNotice = !!ended?.noticedAt && ended.noticedAt <= charge.chargedAt && charge.chargedAt < ended.at;
      if (
        endedAt &&
        endedAt <= now &&
        !paidAfterNotice &&
        endedAt.getTime() < charge.chargedAt.getTime() + this.retireRefundDays * DAY_MS &&
        endedAt < charge.periodEnd
      ) {
        result.push(this.toCandidate(charge, 'ACTOR_RETIRED', deadline, endedAt));
        continue;
      }
      if (charge.periodEnd <= now && (await this.starWasIdle(rooms, charge))) result.push(this.toCandidate(charge, 'STAR_IDLE', deadline, null));
    }
    return result;
  }

  /**
   * 모든 방이 활동 종료됐으면 마지막으로 종료된 때(커플방은 방이나 멤버 중 먼저 종료된 때)와 그 종료의 예정 알림 시각, 하나라도 활동 중이면 null
   */
  private async roomsEnded(roomIds: string[]): Promise<{ at: Date; noticedAt: Date | null } | null> {
    const rooms = await this.prisma.actor.findMany({
      where: { id: { in: roomIds } },
      select: {
        retiredAt: true,
        retireNoticedAt: true,
        coupleMembers: { select: { member: { select: { retiredAt: true, retireNoticedAt: true } } } },
      },
    });
    if (rooms.length < roomIds.length) return null;
    let last: { at: Date; noticedAt: Date | null } | null = null;
    for (const room of rooms) {
      const ends = [room, ...room.coupleMembers.map(({ member }) => member)].filter((row): row is typeof row & { retiredAt: Date } => !!row.retiredAt);
      if (ends.length === 0) return null;
      const first = ends.reduce((a, b) => (b.retiredAt < a.retiredAt ? b : a));
      if (!last || first.retiredAt > last.at) last = { at: first.retiredAt, noticedAt: first.retireNoticedAt ?? null };
    }
    return last;
  }

  /** 그 기간에 스타 메시지가 0개였나 */
  private async starWasIdle(rooms: string[], charge: ChargeRow): Promise<boolean> {
    const sent = await this.prisma.message.count({
      where: { actorId: { in: rooms }, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: { gte: charge.chargedAt, lt: charge.periodEnd } },
    });
    return sent === 0;
  }

  private toCandidate(charge: ChargeRow, reason: RefundReason, deadline: Date, endedAt: Date | null): RefundCandidate {
    return {
      chargeId: charge.id,
      reason,
      productName: charge.productName,
      amountCents: charge.amountCents,
      currency: charge.currency,
      chargedAt: charge.chargedAt.toISOString(),
      periodEnd: charge.periodEnd.toISOString(),
      endedAt: endedAt?.toISOString() ?? null,
      deadline: deadline.toISOString(),
      source: charge.source,
      requested: charge.refundRequests.find((request) => request.reason === reason)?.status ?? null,
    };
  }

  /** 환불 요청 — 대상이 아니면 거절. 구글·테스트는 바로 환불, 애플은 안내 주소 */
  async request(userId: string, chargeId: string, now = new Date()): Promise<{ status: RefundRequestStatus; url?: string }> {
    const candidate = (await this.candidates(userId, now)).find((item) => item.chargeId === chargeId);
    if (!candidate) throw new BadRequestException(appError('REFUND_NOT_ELIGIBLE'));
    const reason = candidate.reason;
    void this.alerts?.notify(
      'REFUND',
      `${candidate.productName} 환불 요청`,
      `사유: ${reason === 'STAR_IDLE' ? '아티스트 미발송' : '활동 종료'} · ฿${(candidate.amountCents / 100).toLocaleString('ko-KR')} · ${candidate.source === ChargeSource.APPLE ? '애플(환불 페이지 안내)' : '바로 환불'}`,
      { chargeId },
    );
    if (candidate.source === ChargeSource.APPLE) {
      await this.prisma.refundRequest.upsert({
        where: { chargeId_reason: { chargeId, reason } },
        create: { chargeId, userId, reason, source: candidate.source, status: RefundRequestStatus.STORE_GUIDED },
        update: {},
      });
      return { status: RefundRequestStatus.STORE_GUIDED, url: APPLE_REFUND_URL };
    }
    // 두 번 눌러도 한 번만 환불 — 요청 기록을 먼저 만들고(고유 제약), 환불이 실패하면 지움
    try {
      await this.prisma.refundRequest.create({ data: { chargeId, userId, reason, source: candidate.source, status: RefundRequestStatus.REFUNDED } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { status: RefundRequestStatus.REFUNDED };
      throw error;
    }
    try {
      const charge = await this.prisma.purchaseCharge.findUniqueOrThrow({ where: { id: chargeId }, select: { storeTransactionId: true } });
      if (candidate.source === ChargeSource.GOOGLE) {
        if (!charge.storeTransactionId) throw new BadRequestException(appError('REFUND_FAILED'));
        await this.iap.refundGoogleOrder(charge.storeTransactionId);
        await this.ledger.markRefunded(this.prisma, charge.storeTransactionId, now);
      } else {
        await this.prisma.purchaseCharge.updateMany({ where: { id: chargeId, refundedAt: null }, data: { refundedAt: now } });
      }
    } catch (error) {
      await this.prisma.refundRequest.deleteMany({ where: { chargeId, reason } });
      throw error;
    }
    return { status: RefundRequestStatus.REFUNDED };
  }

  /**
   * 운영자 환불 요청 목록(최근 순) — 누가·어느 방·얼마·어디 결제·상태. 애플 안내 건은 애플이 실제로 환불했는지(결제 기록의 환불 시각)도 같이.
   * 팬·소속사 이름은 지금 기준(팬이 탈퇴했으면 null).
   */
  /** 애플 안내 후 환불 확인을 기다리는 날 수(서버 설정 APPLE_REFUND_WAIT_DAYS, 기본 3) */
  get appleWaitDays(): number {
    return this.days('APPLE_REFUND_WAIT_DAYS', APPLE_REFUND_WAIT_DAYS);
  }

  /** 운영자 홈 "환불 처리 대기" 개수(2026-10-22) */
  async waitingCount(now = new Date()): Promise<number> {
    return this.prisma.refundRequest.count({ where: storeRefundWaitingWhere(now, this.appleWaitDays) });
  }

  /**
   * 환불 처리 대기 건을 "확인함"으로 정리(2026-10-22) — 운영자가 팬에게 물어보고(애플에 요청했는지, 거절됐는지) 메모를 남김. 애플이 나중에 환불하면
   * 결제 기록은 스토어 알림으로 그대로 환불로 바뀜(이 표시와 상관없음). 작업 기록은 호출하는 쪽(컨트롤러)이 남김.
   */
  async markChecked(adminId: string, requestId: string, note?: string) {
    // 확인할 게 있는 건 애플 안내 건뿐(우리가 환불까지 끝낸 건은 대기가 생기지 않음)
    const row = await this.prisma.refundRequest.findUnique({ where: { id: requestId }, select: { status: true, checkedAt: true } });
    if (!row || row.status !== RefundRequestStatus.STORE_GUIDED) throw new NotFoundException(appError('NOT_FOUND'));
    if (row.checkedAt) return { id: requestId, checkedAt: row.checkedAt.toISOString() };
    const updated = await this.prisma.refundRequest.update({
      where: { id: requestId },
      data: { checkedAt: new Date(), checkedById: adminId, checkedNote: note?.trim() || null },
      select: { id: true, checkedAt: true },
    });
    return { id: updated.id, checkedAt: updated.checkedAt!.toISOString() };
  }

  async adminList(options: { reason?: RefundReason; waiting?: boolean; limit?: number } = {}, now = new Date()) {
    const waitDays = this.appleWaitDays;
    const rows = await this.prisma.refundRequest.findMany({
      where: { ...(options.reason ? { reason: options.reason } : {}), ...(options.waiting ? storeRefundWaitingWhere(now, waitDays) : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(options.limit ?? 200, 500),
      select: {
        id: true,
        userId: true,
        reason: true,
        source: true,
        status: true,
        createdAt: true,
        checkedAt: true,
        checkedById: true,
        checkedNote: true,
        charge: {
          select: {
            id: true,
            productName: true,
            amountCents: true,
            chargedAt: true,
            periodEnd: true,
            refundedAt: true,
            allocations: { select: { agency: { select: { name: true } }, actor: { select: { legalName: true } } } },
          },
        },
      },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set([...rows.map((row) => row.userId), ...rows.flatMap((row) => (row.checkedById ? [row.checkedById] : []))])] } },
      select: { id: true, displayName: true, nickname: true, email: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => {
      const user = userById.get(row.userId);
      return {
        id: row.id,
        reason: row.reason as RefundReason,
        source: row.source,
        status: row.status,
        requestedAt: row.createdAt.toISOString(),
        fan: user ? { id: user.id, name: user.nickname ?? user.displayName, email: user.email } : null,
        productName: row.charge.productName,
        amountCents: row.charge.amountCents,
        chargedAt: row.charge.chargedAt.toISOString(),
        periodEnd: row.charge.periodEnd.toISOString(),
        refundedAt: row.charge.refundedAt?.toISOString() ?? null,
        actors: [...new Set(row.charge.allocations.map((allocation) => allocation.actor.legalName))],
        agencies: [...new Set(row.charge.allocations.map((allocation) => allocation.agency?.name ?? null))],
        // 환불 처리 대기(2026-10-22) — 애플 안내 뒤 waitDays가 지나도 환불이 안 됐고 운영자가 아직 확인 안 함
        waiting:
          row.status === RefundRequestStatus.STORE_GUIDED && !row.charge.refundedAt && !row.checkedAt && row.createdAt.getTime() <= now.getTime() - waitDays * DAY_MS,
        checkedAt: row.checkedAt?.toISOString() ?? null,
        checkedNote: row.checkedNote,
        checkedBy: row.checkedById ? (userById.get(row.checkedById)?.displayName ?? null) : null,
      };
    });
  }
}
