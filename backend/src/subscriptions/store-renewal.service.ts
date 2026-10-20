import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { IapPlatform } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { IapVerificationService } from './iap-verification.service.js';

/** 종료(예정) 방 — 방 자체나 CP 멤버가 종료됐거나 종료 예정 */
const ENDING_ROOM: Prisma.ActorWhereInput = {
  OR: [
    { retiredAt: { not: null } },
    { retireAt: { not: null } },
    { coupleMembers: { some: { member: { OR: [{ retiredAt: { not: null } }, { retireAt: { not: null } }] } } } },
  ],
};

/**
 * 아티스트 활동 종료 때 스토어 자동 갱신 멈추기(2026-10-20 사용자 요청 "자동으로 중지돼야").
 * - 구글: 서버가 구독마다 해지(subscriptionsv2.cancel) — 종료됐거나, 종료 예정인데 지금 낸 기간이 예정일을 넘는(= 다음 갱신은 종료 뒤) 구독만.
 *   예정일 전에 갱신될 구독을 미리 끊으면 팬이 종료 전에 끊기니까, 예정일 전 갱신은 그대로 두고 갱신된 뒤 다음 차례에 끊음(그 결제는 14일 환불 규칙 대상).
 * - 애플: 개발자가 팬 구독을 끊는 API가 없음 → 운영자가 App Store Connect에서 상품 판매 중지 → 운영자 화면에서 [판매 중지함] 표시(appleTodo).
 * 1시간마다 다시 돌아서 실패한 건 다음에 다시 시도.
 */
@Injectable()
export class StoreRenewalService {
  private readonly logger = new Logger(StoreRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iap: IapVerificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    try {
      const stopped = await this.stopGoogleRenewals();
      if (stopped > 0) this.logger.log(`활동 종료 방 구글 구독 갱신 해지 ${stopped}건`);
    } catch (error) {
      this.logger.error('구글 구독 갱신 해지 실패', error as Error);
    }
  }

  /** 해지할 구글 구독 — 그 구매로 열린 방 중 하나라도 종료(예정)인 것(개인 구독은 그 방, 묶음은 든 방) */
  async stopGoogleRenewals(now = new Date()) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        iapPlatform: IapPlatform.ANDROID,
        iapTransactionId: { not: null },
        cancelledAt: null,
        willRenew: true,
        OR: [{ actor: ENDING_ROOM }, { bundle: { actors: { some: { actor: ENDING_ROOM } } } }],
      },
      select: {
        id: true,
        iapTransactionId: true,
        iapExpiresAt: true,
        actor: { select: { retiredAt: true, retireAt: true, coupleMembers: { select: { member: { select: { retiredAt: true, retireAt: true } } } } } },
        bundle: {
          select: {
            actors: { select: { actor: { select: { retiredAt: true, retireAt: true, coupleMembers: { select: { member: { select: { retiredAt: true, retireAt: true } } } } } } } },
          },
        },
      },
    });
    let stopped = 0;
    for (const purchase of purchases) {
      const rooms = purchase.actor ? [purchase.actor] : (purchase.bundle?.actors.map((item) => item.actor) ?? []);
      if (!rooms.some((room) => shouldStopNow(room, purchase.iapExpiresAt, now))) continue;
      try {
        if (!(await this.iap.cancelGoogleSubscription(purchase.iapTransactionId!))) continue;
        await this.prisma.purchase.update({ where: { id: purchase.id }, data: { willRenew: false } });
        stopped += 1;
      } catch (error) {
        this.logger.warn(`구글 구독 해지 실패(purchase ${purchase.id}): ${String(error)}`);
      }
    }
    return stopped;
  }

  /**
   * 운영자 할 일 — 종료(예정) 방이 든 애플 상품 중 아직 [판매 중지함] 표시가 없는 것(개인방·CP방 상품, 묶음 상품). 기존 애플 구독이 남아 있는 것만
   * (아무도 안 샀으면 판매 중지는 신규 구독만 막는 의미라 할 일에서 뺌 — 새 구독은 서버가 이미 막음).
   */
  async appleTodo() {
    const activeApple: Prisma.PurchaseListRelationFilter = { some: { iapPlatform: IapPlatform.IOS, cancelledAt: null, willRenew: true } };
    const [actors, bundles] = await Promise.all([
      this.prisma.actor.findMany({
        where: { ...ENDING_ROOM, storeProductId: { not: null }, storeSaleStoppedAt: null, purchases: activeApple },
        select: { id: true, legalName: true, storeProductId: true, retiredAt: true, retireAt: true },
      }),
      this.prisma.bundle.findMany({
        where: { storeProductId: { not: null }, storeSaleStoppedAt: null, actors: { some: { actor: ENDING_ROOM } }, purchases: activeApple },
        select: { id: true, name: true, storeProductId: true },
      }),
    ]);
    return { actors, bundles };
  }
}

type RoomEnd = { retiredAt: Date | null; retireAt: Date | null; coupleMembers?: { member: { retiredAt: Date | null; retireAt: Date | null } }[] };

/** 지금 해지할지 — 종료됐으면 바로, 종료 예정이면 지금 낸 기간이 예정일 이후까지면(다음 갱신이 종료 뒤) */
export function shouldStopNow(room: RoomEnd, expiresAt: Date | null, now = new Date()): boolean {
  const all = [room, ...(room.coupleMembers ?? []).map(({ member }) => member)];
  if (all.some((item) => item.retiredAt && item.retiredAt <= now)) return true;
  const planned = all.map((item) => item.retireAt).filter((value): value is Date => !!value);
  if (planned.length === 0) return false;
  const retireAt = new Date(Math.min(...planned.map((value) => value.getTime())));
  return !expiresAt || expiresAt >= retireAt;
}
