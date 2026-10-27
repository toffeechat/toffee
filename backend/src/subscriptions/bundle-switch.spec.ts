import { describe, expect, it, vi } from 'vitest';
import { SubscriptionsService } from './subscriptions.service.js';
import { CURRENT_TERMS_VERSION } from '../common/legal/terms.js';
import { googleStoreEvent } from './store-events.js';
import { googleTransaction, type IapVerificationService, type StoreTransaction } from './iap-verification.service.js';
import { ChargeLedgerService } from '../settlements/charge-ledger.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';
import type { ConfigService } from '@nestjs/config';

type Row = Record<string, unknown> & { id: string };
const DAY = 24 * 60 * 60 * 1000;

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; not?: unknown };
      if (c.in) return c.in.includes(value);
      if ('not' in c) return value !== c.not;
    }
    return value === cond;
  });
}

/**
 * 같은 CP 묶음 갈아타기(2026-10-22) — CP방 cp(멤버 a·b), 묶음 bA(a+cp, 상품 p.a)·bB(b+cp, p.b)·bAll(a+b+cp, p.all).
 * 정산 줄 계산은 ChargeLedgerService.creditUnused 테스트에서 따로, 여기선 무엇을 부르는지만.
 */
function setup() {
  let seq = 0;
  const users: Row[] = [{ id: 'u', termsVersion: CURRENT_TERMS_VERSION, birthDate: new Date('2000-01-01'), parentalConsentStatus: 'NOT_REQUIRED' }];
  const actor = (id: string, kind: 'SOLO' | 'COUPLE', members: string[] = []) => ({
    id,
    kind,
    monthlyPriceCents: 100,
    retiredAt: null,
    retireAt: null,
    releaseAt: null,
    coupleMembers: members.map((memberId) => ({ memberId, member: { retiredAt: null, retireAt: null } })),
  });
  const actors = [actor('a', 'SOLO'), actor('b', 'SOLO'), actor('cp', 'COUPLE', ['a', 'b'])];
  const bundles: Row[] = [
    { id: 'bA', name: 'A+CP', priceCents: 180, storeProductId: 'p.a', active: true, releaseAt: null, actorIds: ['a', 'cp'] },
    { id: 'bB', name: 'B+CP', priceCents: 180, storeProductId: 'p.b', active: true, releaseAt: null, actorIds: ['b', 'cp'] },
    { id: 'bAll', name: 'ALL', priceCents: 250, storeProductId: 'p.all', active: true, releaseAt: null, actorIds: ['a', 'b', 'cp'] },
  ];
  const bundleOut = (b: Row | undefined) =>
    b ? { ...b, actors: (b.actorIds as string[]).map((id) => ({ actorId: id, actor: actors.find((a) => a.id === id)! })) } : null;
  const purchases: Row[] = [];
  const subs: Row[] = [];
  const latestCharge: { at: Date | null } = { at: null };
  const withBundle = (p: Row) => ({ ...p, bundle: bundleOut(bundles.find((b) => b.id === p.bundleId)) });
  const db = {
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id)!,
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
    },
    actor: { findUnique: async () => null },
    bundle: { findUnique: async ({ where }: { where: Record<string, unknown> }) => bundleOut(bundles.find((b) => matches(b, where))) },
    purchase: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const found = purchases.find((p) => matches(p, where));
        return found ? withBundle(found) : null;
      },
      findUniqueOrThrow: async ({ where }: { where: Record<string, unknown> }) => withBundle(purchases.find((p) => matches(p, where))!),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = purchases.find((p) => matches(p, where));
        return found ? withBundle(found) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => purchases.filter((p) => matches(p, where)).map(withBundle),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: `p${++seq}`, actorId: null, bundleId: null, cancelledAt: null, iapPlatform: null, iapExpiresAt: null, startedAt: new Date(), ...data };
        purchases.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(purchases.find((p) => p.id === where.id)!, data),
    },
    subscription: {
      findUnique: async () => null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => subs.filter((s) => matches(s, where)),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `s${++seq}`, ...data };
        subs.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(subs.find((s) => s.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = subs.filter((s) => matches(s, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    subscriptionEvent: { create: async () => ({}) },
    purchaseCharge: { findFirst: async () => (latestCharge.at ? { chargedAt: latestCharge.at } : null), findUnique: async () => null },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  let nextTransaction: StoreTransaction | null = null;
  const iap = { verifyApple: async () => nextTransaction!, verifyGoogle: async () => nextTransaction! };
  const ledger = {
    record: vi.fn(async (_tx: unknown, _purchaseId: string, input: { chargedAt: Date }) => {
      latestCharge.at = input.chargedAt;
    }),
    creditUnused: vi.fn(async () => ({ totalCents: 90, fromChargeId: 'c-old', periodEnd: new Date(Date.now() + 15 * DAY) })),
  };
  const service = new SubscriptionsService(
    db as unknown as PrismaService,
    iap as unknown as IapVerificationService,
    {} as MediaService,
    { publish: () => Promise.resolve() } as unknown as RealtimeService,
    ledger as unknown as ChargeLedgerService,
    { get: () => undefined } as unknown as ConfigService,
  );
  const receipt = (overrides: Partial<StoreTransaction> = {}) => {
    nextTransaction = {
      platform: 'IOS',
      originalTransactionId: 'orig-1',
      storeTransactionId: `tx-${++seq}`,
      productId: 'p.a',
      purchasedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * DAY),
      accountToken: 'u',
      ...overrides,
    };
  };
  const openRooms = () => subs.filter((s) => !s.cancelledAt).map((s) => s.actorId).sort();
  const sub = (actorId: string) => subs.find((s) => s.actorId === actorId);
  const ios = { platform: 'IOS' as const, signedTransaction: 'jws' };
  const android = { platform: 'ANDROID' as const, purchaseToken: 'tok', productId: 'x' };
  return { service, purchases, ledger, receipt, openRooms, sub, ios, android, latestCharge };
}

describe('같은 CP 묶음 갈아타기 — 애플(같은 구독에서 상품만 바뀜)', () => {
  it('A+CP → 전체로 올리면 같은 구매가 새 묶음으로, B방이 열리고 CP방 대화는 이어짐, 남은 기간 차감 + 새 결제', async () => {
    const t = setup();
    t.receipt({ productId: 'p.a', purchasedAt: new Date(Date.now() - 10 * DAY) });
    await t.service.verifyBundlePurchase('u', 'bA', t.ios);
    expect(t.openRooms()).toEqual(['a', 'cp']);
    const cpBefore = t.sub('cp')!.startedAt;

    t.receipt({ productId: 'p.all' });
    await t.service.verifyBundlePurchase('u', 'bAll', t.ios);
    expect(t.purchases).toHaveLength(1);
    expect(t.purchases[0]).toMatchObject({ bundleId: 'bAll', priceCents: 250 });
    expect(t.openRooms()).toEqual(['a', 'b', 'cp']);
    expect(t.sub('cp')!.startedAt).toBe(cpBefore);
    expect(t.ledger.creditUnused).toHaveBeenCalledWith(expect.anything(), t.purchases[0].id, expect.any(Date));
    // 애플은 새 묶음 정가 결제(이월 아님)
    expect(t.ledger.record.mock.calls.at(-1)![2]).not.toHaveProperty('kind');
  });

  it('A+CP ↔ B+CP — A방은 닫히고 B방이 열림', async () => {
    const t = setup();
    t.receipt({ productId: 'p.a', purchasedAt: new Date(Date.now() - 5 * DAY) });
    await t.service.verifyBundlePurchase('u', 'bA', t.ios);
    t.receipt({ productId: 'p.b' });
    await t.service.verifyBundlePurchase('u', 'bB', t.ios);
    expect(t.openRooms()).toEqual(['b', 'cp']);
  });

  it('늦게 온 옛 알림(예전 묶음 결제)은 바뀐 구매를 되돌리지 않음', async () => {
    const t = setup();
    t.receipt({ productId: 'p.a', purchasedAt: new Date(Date.now() - 10 * DAY) });
    await t.service.verifyBundlePurchase('u', 'bA', t.ios);
    t.receipt({ productId: 'p.all' });
    await t.service.verifyBundlePurchase('u', 'bAll', t.ios);
    t.receipt({ productId: 'p.a', purchasedAt: new Date(Date.now() - 10 * DAY) });
    await t.service.applyStoreEvent({ kind: 'PAID', transaction: { ...t.ledger.record.mock.calls[0][2], platform: 'IOS', originalTransactionId: 'orig-1', productId: 'p.a', purchasedAt: new Date(Date.now() - 9 * DAY), expiresAt: new Date(Date.now() + 20 * DAY) } as StoreTransaction });
    expect(t.purchases[0]).toMatchObject({ bundleId: 'bAll' });
    expect(t.openRooms()).toEqual(['a', 'b', 'cp']);
  });

  it('바꾸기 안내 — 애플 내리기만 다음 갱신 때, 이 묶음을 이미 가졌으면 없음', async () => {
    const t = setup();
    t.receipt({ productId: 'p.all' });
    await t.service.verifyBundlePurchase('u', 'bAll', t.ios);
    expect(await t.service.switchInfo('u', 'bA')).toMatchObject({ bundle: { id: 'bAll' }, platform: 'IOS', timing: 'next-renewal' });
    expect(await t.service.switchInfo('u', 'bAll')).toBeNull();
  });
});

describe('같은 CP 묶음 갈아타기 — 구글(새 구매가 예전 구매를 대신함)', () => {
  it('새 토큰이 예전 토큰을 가리키면 같은 구매를 이어받고, 남은 기간 몫을 새 묶음으로 이월(새 결제 없음)', async () => {
    const t = setup();
    t.receipt({ platform: 'ANDROID', originalTransactionId: 'tok-old', productId: 'p.a', purchasedAt: new Date(Date.now() - 10 * DAY) });
    await t.service.verifyBundlePurchase('u', 'bA', t.android);
    t.receipt({ platform: 'ANDROID', originalTransactionId: 'tok-new', replacesTransactionId: 'tok-old', productId: 'p.all' });
    await t.service.verifyBundlePurchase('u', 'bAll', t.android);
    expect(t.purchases).toHaveLength(1);
    expect(t.purchases[0]).toMatchObject({ bundleId: 'bAll', iapTransactionId: 'tok-new' });
    expect(t.openRooms()).toEqual(['a', 'b', 'cp']);
    expect(t.ledger.record.mock.calls.at(-1)![2]).toMatchObject({ amountCents: 90, kind: 'SWITCH_CARRY', switchOfChargeId: 'c-old' });
  });

  it('교체돼 끝난 예전 구매의 만료 알림은 무시(방을 닫지 않음)', async () => {
    const old = googleTransaction('tok-old', 'p.a', { expiryTimeMillis: String(Date.now() - 1000), cancelReason: 2 }, new Date());
    expect(old.replaced).toBe(true);
    const event = await googleStoreEvent({ subscriptionNotification: { notificationType: 13, purchaseToken: 'tok-old', subscriptionId: 'p.a' } }, async () => old);
    expect(event.kind).toBe('IGNORED');
    const fresh = googleTransaction('tok-new', 'p.all', { expiryTimeMillis: String(Date.now() + DAY), linkedPurchaseToken: 'tok-old' }, new Date());
    expect(fresh.replacesTransactionId).toBe('tok-old');
  });
});

describe('같은 CP 묶음 갈아타기 — 테스트 구독(결제 없음)', () => {
  it('같은 CP 묶음을 하나 더 사지 못하고, 바꾸기는 바로 + 남은 몫 이월', async () => {
    const t = setup();
    await t.service.subscribeBundle('u', 'bA');
    await expect(t.service.subscribeBundle('u', 'bB')).rejects.toMatchObject({ response: { code: 'BUNDLE_SWITCH_INSTEAD' } });
    expect(await t.service.switchInfo('u', 'bB')).toMatchObject({ platform: null, timing: 'now' });
    await t.service.switchBundle('u', 'bB');
    expect(t.purchases.filter((p) => !p.cancelledAt)).toHaveLength(1);
    expect(t.openRooms()).toEqual(['b', 'cp']);
    expect(t.ledger.record.mock.calls.at(-1)![2]).toMatchObject({ kind: 'SWITCH_CARRY', amountCents: 90 });
  });

  it('스토어 구독은 앱 안에서 바꾸지 않음(스토어 결제창으로)', async () => {
    const t = setup();
    t.receipt({ productId: 'p.a' });
    await t.service.verifyBundlePurchase('u', 'bA', t.ios);
    await expect(t.service.switchBundle('u', 'bB')).rejects.toMatchObject({ response: { code: 'IAP_MANAGE_IN_STORE' } });
  });
});

describe('정산 — 기간 중간에 바꾸면 안 쓴 기간 몫을 예전 묶음에서 뺌', () => {
  it('30일 결제 ฿300을 10일 쓰고 바꾸면 -฿200, 원래 배분 비율대로(같은 소속사), 같은 결제는 한 번만', async () => {
    const chargedAt = new Date('2026-10-01T00:00:00Z');
    const periodEnd = new Date('2026-10-31T00:00:00Z');
    const at = new Date('2026-10-11T00:00:00Z');
    const create = vi.fn().mockResolvedValue({});
    const db = {
      purchaseCharge: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'c1',
              actorId: null,
              bundleId: 'bA',
              productName: 'A+CP',
              amountCents: 30000,
              currency: 'THB',
              chargedAt,
              periodEnd,
              source: 'APPLE',
              allocations: [
                { roomId: 'a', actorId: 'a', agencyId: 'ag', amountCents: 15000 },
                { roomId: 'cp', actorId: 'a', agencyId: 'ag', amountCents: 7500 },
                { roomId: 'cp', actorId: 'b', agencyId: 'ag2', amountCents: 7500 },
              ],
            },
          ])
          .mockResolvedValueOnce([]),
        create,
      },
    };
    const ledger = new ChargeLedgerService({} as PrismaService);
    const credit = await ledger.creditUnused(db as never, 'p1', at);
    expect(credit).toEqual({ totalCents: 20000, fromChargeId: 'c1', periodEnd });
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ amountCents: -20000, kind: 'SWITCH_CREDIT', switchOfChargeId: 'c1', source: 'APPLE', periodEnd });
    expect(data.chargedAt.getTime()).toBe(at.getTime() - 1);
    expect(data.allocations.create).toEqual([
      { roomId: 'a', actorId: 'a', agencyId: 'ag', amountCents: -10000 },
      { roomId: 'cp', actorId: 'a', agencyId: 'ag', amountCents: -5000 },
      { roomId: 'cp', actorId: 'b', agencyId: 'ag2', amountCents: -5000 },
    ]);

    // 이미 뺀 결제(switchOfChargeId 있음)는 다시 안 뺌
    const again = {
      purchaseCharge: {
        findMany: vi.fn().mockResolvedValueOnce([{ id: 'c1', amountCents: 30000, chargedAt, periodEnd, allocations: [] }]).mockResolvedValueOnce([{ switchOfChargeId: 'c1' }]),
        create: vi.fn(),
      },
    };
    expect((await ledger.creditUnused(again as never, 'p1', at)).totalCents).toBe(0);
    expect(again.purchaseCharge.create).not.toHaveBeenCalled();
  });
});
