import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShutdownService } from '../common/lifecycle/shutdown.service.js';
import { ActorKind, ChargeKind, ChargeSource, IapPlatform } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { addMonths, allocateCharge, type ChargeRoom } from './allocate-charge.js';
import { allocateBundlePrice } from '../subscriptions/allocate-price.js';

type Db = Prisma.TransactionClient | PrismaService;

const ROOM_SELECT = { id: true, kind: true, monthlyPriceCents: true, coupleMembers: { select: { memberId: true } } } as const;
const PURCHASE_SELECT = {
  id: true,
  actorId: true,
  bundleId: true,
  priceCents: true,
  startedAt: true,
  cancelledAt: true,
  iapPlatform: true,
  iapExpiresAt: true,
  actor: { select: { ...ROOM_SELECT, legalName: true } },
  bundle: { select: { name: true, priceCents: true, actors: { select: { actor: { select: ROOM_SELECT } } } } },
} as const;
type PurchaseForCharge = Prisma.PurchaseGetPayload<{ select: typeof PURCHASE_SELECT }>;
type RoomRow = Prisma.ActorGetPayload<{ select: typeof ROOM_SELECT }>;

export interface ChargeInput {
  chargedAt: Date;
  periodEnd?: Date;
  source: ChargeSource;
  storeTransactionId?: string;
  amountCents?: number;
  currency?: string;
  // 스토어가 실제로 청구한 금액(1/1000 단위)·통화 — 대조용
  storeAmountMilli?: number;
  storeCurrency?: string;
  // 묶음 갈아타기 이월 줄(2026-10-22) — 기본은 실제 결제(PAYMENT)
  kind?: ChargeKind;
  switchOfChargeId?: string;
  // 상품 이름 뒤에 붙일 설명(예: "(묶음 변경 — 이월)")
  productNote?: string;
}

/** 묶음 갈아타기로 뺀 안 쓴 기간 몫(creditUnused 결과) */
export interface SwitchCredit {
  /** 뺀 합계(양수) — 구글·테스트 구독은 이만큼을 새 묶음으로 이월 */
  totalCents: number;
  /** 뺀 결제 중 첫 번째(이월 줄이 가리킴) */
  fromChargeId: string | null;
  /** 뺀 결제들의 이용 기간 끝 중 가장 늦은 것 */
  periodEnd: Date | null;
}

export function sourceOf(platform: IapPlatform | null): ChargeSource {
  return platform === IapPlatform.IOS ? ChargeSource.APPLE : platform === IapPlatform.ANDROID ? ChargeSource.GOOGLE : ChargeSource.SANDBOX;
}

function toChargeRoom(room: RoomRow): ChargeRoom {
  return {
    id: room.id,
    monthlyPriceCents: room.monthlyPriceCents,
    memberIds: room.kind === ActorKind.COUPLE ? room.coupleMembers.map((member) => member.memberId) : [room.id],
  };
}

/**
 * 결제 기록(정산의 기준, 2026-09-29). 결제 1건마다 PurchaseCharge 한 줄 + 배우별 몫(ChargeAllocation)을 결제 순간 기준으로 고정.
 * - 첫 결제: 구매가 생길 때(SubscriptionsService) 바로 기록.
 * - 갱신: 스토어 결제는 스토어 알림·영수증 재검증이 기록(storeTransactionId로 중복 방지), 샌드박스는 fillMissing이 매달 흉내.
 * - 이 표가 생기기 전 구매·기록이 빠진 구매는 fillMissing(서버 시작 시·매시간)이 채움. 같은 구매·같은 시각은 한 번만(고유 제약).
 */
@Injectable()
export class ChargeLedgerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChargeLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shutdown: ShutdownService,
  ) {}

  onApplicationBootstrap() {
    // 시작을 늦추지 않게 기다리지 않음 — 켜자마자 꺼지면(재배포 반복) 끝날 때까지 DB 연결을 끊지 않게 종료 대기에 넣음(2026-10-28)
    void this.shutdown.track(this.fillMissing()).catch((error: unknown) => this.logger.error(`결제 기록 채우기 실패: ${String(error)}`));
  }

  /** 결제 1건 기록 — 이미 있으면(같은 구매·시각 또는 같은 스토어 결제 id) 기존 것을 돌려줌 */
  async record(db: Db, purchaseId: string, input: ChargeInput) {
    const purchase = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId }, select: PURCHASE_SELECT });
    return this.recordFor(db, purchase, input);
  }

  private async recordFor(db: Db, purchase: PurchaseForCharge, input: ChargeInput) {
    const existing = await db.purchaseCharge.findFirst({
      where: {
        OR: [
          { purchaseId: purchase.id, chargedAt: input.chargedAt },
          ...(input.storeTransactionId ? [{ storeTransactionId: input.storeTransactionId }] : []),
        ],
      },
    });
    if (existing) return existing;

    const rooms = purchase.actor ? [purchase.actor] : (purchase.bundle?.actors.map((item) => item.actor) ?? []);
    const currency = input.currency ?? 'THB';
    // 스토어가 같은 통화로 실제 청구한 금액이 있으면 그것으로(첫 달 ฿99 할인·프로모션이 정가 ฿149로 정산되던 문제, 2026-10-28 점검).
    // 다른 통화(해외 가격)는 아직 표시 가격 기준 — 실제 금액 기준 정산은 STATUS 할 일
    const storeCents = input.storeAmountMilli != null && input.storeCurrency === currency ? Math.round(input.storeAmountMilli / 10) : undefined;
    const amountCents = input.amountCents ?? storeCents ?? purchase.priceCents ?? purchase.bundle?.priceCents ?? purchase.actor?.monthlyPriceCents ?? 0;
    const lines = allocateCharge(amountCents, rooms.map(toChargeRoom));
    const agencies = await this.agenciesAt(db, [...new Set(lines.map((line) => line.actorId))], input.chargedAt);
    try {
      return await db.purchaseCharge.create({
        data: {
          purchaseId: purchase.id,
          actorId: purchase.actorId,
          bundleId: purchase.bundleId,
          productName: `${purchase.bundle?.name ?? purchase.actor?.legalName ?? ''}${input.productNote ? ` ${input.productNote}` : ''}`,
          amountCents,
          currency,
          chargedAt: input.chargedAt,
          periodEnd: input.periodEnd ?? addMonths(input.chargedAt, 1),
          source: input.source,
          storeTransactionId: input.storeTransactionId,
          storeAmountMilli: input.storeAmountMilli,
          storeCurrency: input.storeCurrency,
          kind: input.kind,
          switchOfChargeId: input.switchOfChargeId,
          allocations: { create: lines.map((line) => ({ ...line, agencyId: agencies.get(line.actorId) ?? null })) },
        },
      });
    } catch (error) {
      // 다른 서버가 같은 결제를 먼저 기록함 — 그걸 돌려줌
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return db.purchaseCharge.findFirstOrThrow({
          where: {
            OR: [
              { purchaseId: purchase.id, chargedAt: input.chargedAt },
              ...(input.storeTransactionId ? [{ storeTransactionId: input.storeTransactionId }] : []),
            ],
          },
        });
      }
      throw error;
    }
  }

  /**
   * 같은 CP 묶음 갈아타기(2026-10-22) — 기간 중간(at)에 묶음이 바뀌면, 그때 이용 중이던 결제(실제 결제·이월, 환불 안 됨)마다 안 쓴 기간 몫
   * (금액 × 남은 시간 / 전체 기간)을 예전 묶음 아티스트에게서 빼는 줄(SWITCH_CREDIT, 음수)을 만듦. 몫은 그 결제의 원래 배분(방·배우·소속사) 비율대로.
   * 과거 줄은 고치지 않아서 마감한 달 숫자는 그대로. 같은 결제는 한 번만 뺌(switchOfChargeId). 결제일에 바뀌면(애플 내리기) 뺄 게 없음.
   * 차감 줄의 chargedAt은 같은 구매·같은 시각 고유 제약을 피하려고 at보다 1ms씩 앞.
   */
  async creditUnused(db: Db, purchaseId: string, at: Date): Promise<SwitchCredit> {
    const covering = await db.purchaseCharge.findMany({
      where: {
        purchaseId,
        kind: { in: [ChargeKind.PAYMENT, ChargeKind.SWITCH_CARRY] },
        refundedAt: null,
        chargedAt: { lt: at },
        periodEnd: { gt: at },
      },
      orderBy: { chargedAt: 'asc' },
      select: {
        id: true,
        actorId: true,
        bundleId: true,
        productName: true,
        amountCents: true,
        currency: true,
        chargedAt: true,
        periodEnd: true,
        source: true,
        allocations: { select: { roomId: true, actorId: true, agencyId: true, amountCents: true } },
      },
    });
    const done = new Set(
      (await db.purchaseCharge.findMany({ where: { switchOfChargeId: { in: covering.map((charge) => charge.id) }, kind: ChargeKind.SWITCH_CREDIT }, select: { switchOfChargeId: true } })).map(
        (row) => row.switchOfChargeId,
      ),
    );
    const result: SwitchCredit = { totalCents: 0, fromChargeId: null, periodEnd: null };
    let offset = 0;
    for (const charge of covering) {
      if (done.has(charge.id) || charge.amountCents <= 0) continue;
      const unused = Math.round((charge.amountCents * (charge.periodEnd.getTime() - at.getTime())) / (charge.periodEnd.getTime() - charge.chargedAt.getTime()));
      if (unused <= 0) continue;
      const split = allocateBundlePrice(unused, charge.allocations.map((line, index) => ({ id: String(index), monthlyPriceCents: line.amountCents })));
      offset += 1;
      await db.purchaseCharge.create({
        data: {
          purchaseId,
          actorId: charge.actorId,
          bundleId: charge.bundleId,
          productName: `${charge.productName} (묶음 변경 — 안 쓴 기간 차감)`,
          amountCents: -unused,
          currency: charge.currency,
          chargedAt: new Date(at.getTime() - offset),
          periodEnd: charge.periodEnd,
          source: charge.source,
          kind: ChargeKind.SWITCH_CREDIT,
          switchOfChargeId: charge.id,
          allocations: {
            create: charge.allocations.map((line, index) => ({ roomId: line.roomId, actorId: line.actorId, agencyId: line.agencyId, amountCents: -(split.get(String(index)) ?? 0) })),
          },
        },
      });
      result.totalCents += unused;
      result.fromChargeId ??= charge.id;
      if (!result.periodEnd || charge.periodEnd > result.periodEnd) result.periodEnd = charge.periodEnd;
    }
    return result;
  }

  /**
   * 스토어 환불 — 그 결제를 정산에서 빼고 환불 칸으로(이미 환불 표시된 건 그대로). 몇 건 바뀌었는지.
   * 그 결제를 가리키는 갈아타기 차감·이월 줄도 같이(2026-10-28 점검 — 원래 결제만 빠지고 차감 −145가 남아 소속사가 받은 적 없는 돈을 떠안았음)
   */
  async markRefunded(db: Db, storeTransactionId: string, at = new Date()) {
    const { count } = await db.purchaseCharge.updateMany({ where: { storeTransactionId, refundedAt: null }, data: { refundedAt: at } });
    if (count > 0) {
      const ids = (await db.purchaseCharge.findMany({ where: { storeTransactionId }, select: { id: true } })).map((row) => row.id);
      await db.purchaseCharge.updateMany({ where: { switchOfChargeId: { in: ids }, refundedAt: null }, data: { refundedAt: at } });
    }
    return count;
  }

  /** 애플 환불 취소(REFUND_REVERSED, 2026-10-27) — 환불 표시를 지워 다시 정산에 넣음(마감한 달이면 지운 달의 조정으로 들어가지 않으니 운영자가 확인). 같이 뺀 갈아타기 줄도 되돌림 */
  async unmarkRefunded(db: Db, storeTransactionId: string) {
    const { count } = await db.purchaseCharge.updateMany({ where: { storeTransactionId, refundedAt: { not: null } }, data: { refundedAt: null } });
    if (count > 0) {
      const ids = (await db.purchaseCharge.findMany({ where: { storeTransactionId }, select: { id: true } })).map((row) => row.id);
      await db.purchaseCharge.updateMany({ where: { switchOfChargeId: { in: ids }, refundedAt: { not: null } }, data: { refundedAt: null } });
    }
    return count;
  }

  /**
   * 결제 순간 각 배우의 소속사 — 이적 기록(ActorAgencyHistory)이 있으면 그 시점 기록으로(그 시점에 무소속이었으면 null), 기록이
   * 아예 없는 배우(이력 기능 전 배정)는 지금 소속사로.
   */
  private async agenciesAt(db: Db, actorIds: string[], at: Date): Promise<Map<string, string | null>> {
    if (actorIds.length === 0) return new Map();
    const [history, actors] = await Promise.all([
      db.actorAgencyHistory.findMany({ where: { actorId: { in: actorIds } }, orderBy: { startedAt: 'desc' } }),
      db.actor.findMany({ where: { id: { in: actorIds } }, select: { id: true, agencyId: true } }),
    ]);
    return new Map(
      actors.map((actor) => {
        const rows = history.filter((row) => row.actorId === actor.id);
        if (rows.length === 0) return [actor.id, actor.agencyId] as const;
        const hit = rows.find((row) => row.startedAt <= at && (!row.endedAt || row.endedAt > at));
        return [actor.id, hit?.agencyId ?? null] as const;
      }),
    );
  }

  /**
   * 빠진 결제 기록 채우기 — 샌드박스 구매는 시작일부터 매달(해지 전·지금 이전까지) 한 건씩, 스토어 구매는 기록이 하나도 없으면
   * 첫 결제 한 건(이후 갱신은 스토어 알림이 기록). 몇 번 돌아도 결과가 같음.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async fillMissing(now = new Date()) {
    const purchases = await this.prisma.purchase.findMany({
      where: { OR: [{ iapPlatform: null }, { charges: { none: {} } }] },
      select: { ...PURCHASE_SELECT, charges: { select: { chargedAt: true } } },
    });
    let created = 0;
    for (const purchase of purchases) {
      const have = new Set(purchase.charges.map((charge) => charge.chargedAt.getTime()));
      const source = sourceOf(purchase.iapPlatform);
      if (source !== ChargeSource.SANDBOX) {
        if (have.size === 0) {
          await this.recordFor(this.prisma, purchase, { chargedAt: purchase.startedAt, periodEnd: purchase.iapExpiresAt ?? undefined, source });
          created += 1;
        }
        continue;
      }
      const end = purchase.cancelledAt && purchase.cancelledAt < now ? purchase.cancelledAt : now;
      for (let k = 0; ; k += 1) {
        const chargedAt = addMonths(purchase.startedAt, k);
        if (chargedAt > end || (k > 0 && chargedAt.getTime() === end.getTime())) break;
        if (have.has(chargedAt.getTime())) continue;
        await this.recordFor(this.prisma, purchase, { chargedAt, source });
        created += 1;
      }
    }
    if (created > 0) this.logger.log(`결제 기록 ${created}건 채움`);
    return created;
  }
}
