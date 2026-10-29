import { describe, expect, it } from 'vitest';
import { endsAtOf, renewsAtOf, SubscriptionsService } from './subscriptions.service.js';
import { CURRENT_TERMS_VERSION } from '../common/legal/terms.js';
import { appleStoreEvent, googleStoreEvent } from './store-events.js';
import { appleTransaction, googleTransaction, type IapVerificationService, type StoreTransaction } from './iap-verification.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';
import type { AdminAlertService } from '../notifications/admin-alert.service.js';
import type { ChargeLedgerService } from '../settlements/charge-ledger.service.js';
import type { ConfigService } from '@nestjs/config';

type Row = Record<string, unknown> & { id: string };

// where 조건 흉내: 같은 값, { in }, { not: null }, { lt }
function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Record<string, unknown>[]).some((branch) => matches(row, branch));
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; not?: unknown; lt?: Date };
      if (c.in) return c.in.includes(value);
      if ('not' in c) return value !== c.not;
      if (c.lt) return value instanceof Date && value < c.lt;
    }
    return value === cond;
  });
}

const DAY = 24 * 60 * 60 * 1000;

/** 스토어 결제 흐름을 확인할 만큼만 흉내 낸 메모리 DB — 배우 a1(상품 toffee.a1), 묶음 b1(a1+a2, 상품 toffee.b1) */
function setup() {
  let seq = 0;
  const users: Row[] = [
    { id: 'u', termsVersion: CURRENT_TERMS_VERSION, birthDate: new Date('2000-01-01'), parentalConsentStatus: 'NOT_REQUIRED' },
    { id: 'other', termsVersion: CURRENT_TERMS_VERSION, birthDate: new Date('2000-01-01'), parentalConsentStatus: 'NOT_REQUIRED' },
  ];
  const actors: Row[] = [
    { id: 'a1', monthlyPriceCents: 3000, storeProductId: 'toffee.a1', retiredAt: null, coupleMembers: [] },
    { id: 'a2', monthlyPriceCents: 3000, storeProductId: null, retiredAt: null, coupleMembers: [] },
  ];
  const bundles: Row[] = [{ id: 'b1', name: 'A+B', priceCents: 5000, storeProductId: 'toffee.b1', active: true, actorIds: ['a1', 'a2'] }];
  const purchases: Row[] = [];
  const subs: Row[] = [];
  const charges: { purchaseId: string; storeTransactionId?: string; chargedAt: Date; periodEnd?: Date; refundedAt?: Date | null; source?: string }[] = [];
  const refunded: string[] = [];
  const events: string[] = [];
  const acknowledged: string[] = [];
  const alerts: string[] = [];
  const actorOut = (a: Row) => a && { ...a, actors: undefined };
  const bundleOut = (b: Row) =>
    b && { ...b, actors: (b.actorIds as string[]).map((id) => ({ actorId: id, actor: actors.find((a) => a.id === id)! })) };
  const withBundle = (p: Row) => {
    const b = bundles.find((x) => x.id === p.bundleId);
    return { ...p, bundle: b ? { id: b.id, name: b.name, priceCents: b.priceCents, actors: (b.actorIds as string[]).map((actorId) => ({ actorId })) } : null };
  };
  const db = {
    user: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id)!,
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
    },
    actor: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => actorOut(actors.find((a) => matches(a, where))!) ?? null,
      findUniqueOrThrow: async ({ where }: { where: Record<string, unknown> }) => actors.find((a) => matches(a, where))!,
    },
    bundle: { findUnique: async ({ where }: { where: Record<string, unknown> }) => bundleOut(bundles.find((b) => matches(b, where))!) ?? null },
    purchase: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const found = purchases.find((p) => matches(p, where));
        return found ? withBundle(found) : null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const found = purchases.find((p) => matches(p, where));
        return found ? withBundle(found) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => purchases.filter((p) => matches(p, where)).map(withBundle),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: `p${++seq}`, actorId: null, bundleId: null, cancelledAt: null, iapPlatform: null, iapExpiresAt: null, ...data };
        purchases.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(purchases.find((p) => p.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = purchases.filter((p) => matches(p, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    subscription: {
      findUniqueOrThrow: async ({ where }: { where: { userId_actorId: { userId: string; actorId: string } } }) =>
        subs.find((s) => s.userId === where.userId_actorId.userId && s.actorId === where.userId_actorId.actorId)!,
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
    subscriptionEvent: { create: async ({ data }: { data: { type: string } }) => events.push(data.type) },
    purchaseCharge: {
      findUnique: async ({ where }: { where: { storeTransactionId: string } }) => charges.find((c) => c.storeTransactionId === where.storeTransactionId) ?? null,
      // 이 구매의 가장 최근 결제(회복 판정)
      findFirst: async ({ where }: { where: { purchaseId: string } }) =>
        charges.filter((c) => c.purchaseId === where.purchaseId).sort((a, b) => +b.chargedAt - +a.chargedAt)[0] ?? null,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    $executeRaw: async () => 0,
  };
  let nextTransaction: StoreTransaction | null = null;
  const iap = {
    verifyApple: async () => nextTransaction!,
    verifyGoogle: async () => nextTransaction!,
    acknowledgeGoogle: async (token: string) => acknowledged.push(token),
  };
  const ledger = {
    record: async (_tx: unknown, purchaseId: string, input: { storeTransactionId?: string; chargedAt: Date; source?: string }) => {
      if (input.storeTransactionId && charges.some((c) => c.storeTransactionId === input.storeTransactionId)) return;
      charges.push({ purchaseId, storeTransactionId: input.storeTransactionId, chargedAt: input.chargedAt, source: input.source, refundedAt: null });
    },
    markRefunded: async (_db: unknown, storeTransactionId: string) => {
      refunded.push(storeTransactionId);
      charges.filter((c) => c.storeTransactionId === storeTransactionId).forEach((c) => (c.refundedAt = new Date()));
    },
    unmarkRefunded: async (_db: unknown, storeTransactionId: string) => {
      charges.filter((c) => c.storeTransactionId === storeTransactionId).forEach((c) => (c.refundedAt = null));
    },
  };
  const service = new SubscriptionsService(
    db as unknown as PrismaService,
    iap as unknown as IapVerificationService,
    {} as MediaService,
    { publish: () => Promise.resolve() } as unknown as RealtimeService,
    ledger as unknown as ChargeLedgerService,
    { get: () => undefined } as unknown as ConfigService,
    { notify: async (_kind: string, title: string) => alerts.push(title) } as unknown as AdminAlertService,
  );
  const receipt = (overrides: Partial<StoreTransaction> = {}) => {
    nextTransaction = {
      platform: 'IOS',
      originalTransactionId: 'orig-1',
      storeTransactionId: 'tx-1',
      productId: 'toffee.a1',
      purchasedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * DAY),
      accountToken: 'u',
      ...overrides,
    };
    return nextTransaction;
  };
  const open = (actorId: string, userId = 'u') => subs.find((s) => s.actorId === actorId && s.userId === userId && !s.cancelledAt);
  const iosDto = { platform: 'IOS' as const, signedTransaction: 'jws' };
  return { service, users, actors, purchases, subs, charges, refunded, events, acknowledged, alerts, receipt, open, iosDto };
}

describe('스토어 결제 확인', () => {
  it('맞는 상품이면 구매·방·첫 결제 기록', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    expect(t.open('a1')).toBeTruthy();
    expect(t.purchases[0]).toMatchObject({ actorId: 'a1', iapTransactionId: 'orig-1', iapPlatform: 'IOS' });
    expect(t.charges).toEqual([expect.objectContaining({ purchaseId: t.purchases[0].id, storeTransactionId: 'tx-1' })]);
  });

  it('다른 아티스트·묶음의 상품 영수증으로는 못 엶', async () => {
    const t = setup();
    t.receipt({ productId: 'toffee.b1' });
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('이 방의 구독 상품');
    t.receipt({ productId: 'toffee.unknown' });
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('등록되지 않은 상품');
    expect(t.purchases).toHaveLength(0);
  });

  it('만료된 영수증·다른 계정의 영수증은 거절', async () => {
    const t = setup();
    t.receipt({ expiresAt: new Date(Date.now() - 1000) });
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('만료');
    t.receipt({ accountToken: 'other' });
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('다른 계정');
    // 계정 표시가 없는 영수증이라도 이미 다른 계정에 연결돼 있으면 거절
    t.receipt({ accountToken: undefined });
    await t.service.verifyPurchase('other', 'a1', t.iosDto);
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('다른 계정');
  });

  it('묶음 결제는 포함된 방을 모두 엶', async () => {
    const t = setup();
    t.receipt({ productId: 'toffee.b1' });
    const result = await t.service.verifyBundlePurchase('u', 'b1', t.iosDto);
    expect(result.actorIds).toEqual(['a1', 'a2']);
    expect(t.open('a1') && t.open('a2')).toBeTruthy();
  });

  it('구매 복원은 하나가 실패해도 나머지를 복원하고 결과를 하나씩 알려 줌', async () => {
    const t = setup();
    t.receipt();
    const { results } = await t.service.restorePurchases('u', [t.iosDto]);
    expect(results).toEqual([{ productId: 'toffee.a1', restored: true }]);
    t.receipt({ productId: 'nope' });
    const failed = await t.service.restorePurchases('u', [t.iosDto]);
    expect(failed.results[0]).toMatchObject({ restored: false, code: 'IAP_PRODUCT_UNKNOWN' });
  });

  it('스토어 구독은 앱에서 해지하지 않고 스토어로 안내', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await expect(t.service.unsubscribe('u', 'a1')).rejects.toThrow('구독 관리');
    expect(t.open('a1')).toBeTruthy();
  });
});

describe('스토어 알림 반영', () => {
  it('갱신: 만료일이 늘고 새 결제가 한 번만 기록됨(같은 알림이 두 번 와도)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const renewed = t.receipt({ storeTransactionId: 'tx-2', purchasedAt: new Date(Date.now() + 30 * DAY), expiresAt: new Date(Date.now() + 60 * DAY) });
    await t.service.applyStoreEvent({ kind: 'PAID', transaction: renewed });
    await t.service.applyStoreEvent({ kind: 'PAID', transaction: renewed });
    expect(t.charges.map((c) => c.storeTransactionId)).toEqual(['tx-1', 'tx-2']);
    expect(t.purchases[0].iapExpiresAt).toEqual(renewed.expiresAt);
  });

  it('앱이 확인 요청을 못 보냈어도 결제에 심은 사용자 id로 구매를 만듦', async () => {
    const t = setup();
    await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt() });
    expect(t.open('a1')).toBeTruthy();
    // 사용자 id가 없거나 모르는 사용자면 아무것도 안 함(앱의 확인 요청을 기다림)
    const t2 = setup();
    expect(await t2.service.applyStoreEvent({ kind: 'PAID', transaction: t2.receipt({ accountToken: undefined }) })).toEqual({ applied: false });
    expect(await t2.service.applyStoreEvent({ kind: 'PAID', transaction: t2.receipt({ accountToken: 'ghost' }) })).toEqual({ applied: false });
  });

  it('스토어 알림은 판매 중지·종료 예정이어도 이미 결제된 구매를 엶(앱 확인 요청만 막음, 2026-10-28)', async () => {
    const t = setup();
    t.actors[0].retireAt = new Date(Date.now() + 10 * DAY);
    t.receipt();
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow();
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt() })).toEqual({ applied: true });
    expect(t.open('a1')).toBeTruthy();
  });

  it('알림으로 처음 만드는 구매도 부모 동의 대기·성년 미만이면 방을 열지 않고 운영자에게 알림(2026-10-28)', async () => {
    const t = setup();
    t.users[0].parentalConsentStatus = 'UNDERAGE';
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt() })).toEqual({ applied: false });
    expect(t.open('a1')).toBeUndefined();
    expect(t.alerts).toHaveLength(1);
  });

  it('기록에 없는 결제의 환불 알림은 지금 이용 중인 구매를 닫지 않고 운영자에게 알림(2026-10-28)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await t.service.applyStoreEvent({ kind: 'REFUNDED', originalTransactionId: 'orig-1', storeTransactionId: 'tx-unknown' });
    expect(t.open('a1')).toBeDefined();
    expect(t.alerts).toHaveLength(1);
  });

  it('약관 버전이 바뀐 뒤 다시 동의하기 전에도 구매 복원은 됨(새 결제 확인은 막음, 2026-10-28)', async () => {
    const t = setup();
    t.users[0].termsVersion = '2000-01-01';
    t.receipt();
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow();
    const { results } = await t.service.restorePurchases('u', [t.iosDto]);
    expect(results).toEqual([{ productId: 'toffee.a1', restored: true }]);
  });

  it('만료로 닫힌 뒤 늦게 온 "결제됨" 알림(기간도 끝난 결제)은 결제만 기록하고 방을 다시 열지 않음(2026-10-28)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await t.service.applyStoreEvent({ kind: 'EXPIRED', originalTransactionId: 'orig-1' });
    const late = t.receipt({ storeTransactionId: 'tx-late', purchasedAt: new Date(Date.now() - 31 * DAY), expiresAt: new Date(Date.now() - DAY) });
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: late })).toEqual({ applied: true });
    expect(t.open('a1')).toBeUndefined();
    expect(t.charges.map((c) => c.storeTransactionId)).toContain('tx-late');
  });

  it('만료되면 방이 닫히고, 환불되면 결제 기록이 환불로 바뀌고 방도 닫힘', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await t.service.applyStoreEvent({ kind: 'EXPIRED', originalTransactionId: 'orig-1' });
    expect(t.open('a1')).toBeUndefined();

    const r = setup();
    r.receipt();
    await r.service.verifyPurchase('u', 'a1', r.iosDto);
    await r.service.applyStoreEvent({ kind: 'REFUNDED', originalTransactionId: 'orig-1', storeTransactionId: 'tx-1' });
    expect(r.refunded).toEqual(['tx-1']);
    expect(r.open('a1')).toBeUndefined();
  });

  it('이미 끝난 지난 기간 결제만 환불되면(미발송 환불) 지금 기간 이용은 그대로', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    t.charges.push({ purchaseId: 'p1', storeTransactionId: 'tx-old', chargedAt: new Date(Date.now() - 40 * DAY), periodEnd: new Date(Date.now() - 10 * DAY) });
    await t.service.applyStoreEvent({ kind: 'REFUNDED', originalTransactionId: 'orig-1', storeTransactionId: 'tx-old' });
    expect(t.refunded).toEqual(['tx-old']);
    expect(t.open('a1')).toBeDefined();
  });

  it('순서가 뒤바뀌어 늦게 온 옛 만료 알림은 무시(그 사이 갱신된 구독을 닫지 않음)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const oldExpiry = new Date(Date.now() - DAY);
    expect(await t.service.applyStoreEvent({ kind: 'EXPIRED', originalTransactionId: 'orig-1', expiresAt: oldExpiry })).toEqual({ applied: false });
    // 아직 만료 전인데 온 만료 알림도 무시
    expect(await t.service.applyStoreEvent({ kind: 'EXPIRED', originalTransactionId: 'orig-1', expiresAt: new Date(Date.now() + DAY) })).toEqual({
      applied: false,
    });
    expect(t.open('a1')).toBeTruthy();
  });

  it('자동 갱신을 끄면 방은 그대로, 기간 끝 날짜가 "○일까지 이용"으로 — 다시 켜면 사라짐', async () => {
    const t = setup();
    const receipt = t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    expect((await t.service.applyStoreEvent({ kind: 'RENEWAL', originalTransactionId: receipt.originalTransactionId, willRenew: false })).applied).toBe(true);
    expect(t.open('a1')).toBeTruthy();
    expect(endsAtOf(t.purchases as never)).toEqual(receipt.expiresAt);
    await t.service.applyStoreEvent({ kind: 'RENEWAL', originalTransactionId: receipt.originalTransactionId, willRenew: true });
    expect(endsAtOf(t.purchases as never)).toBeNull();
  });

  it('이용 종료 날짜: 방을 여는 구매가 전부 갱신 꺼짐일 때만, 그중 가장 늦은 날', () => {
    const a = new Date('2026-11-01T00:00:00Z');
    const b = new Date('2026-11-15T00:00:00Z');
    expect(endsAtOf([{ iapExpiresAt: a, willRenew: false }, { iapExpiresAt: b, willRenew: false }])).toEqual(b);
    expect(endsAtOf([{ iapExpiresAt: a, willRenew: false }, { iapExpiresAt: b, willRenew: true }])).toBeNull();
    // 테스트 구독(만료일 없음)은 계속 이용
    expect(endsAtOf([{ iapExpiresAt: null, willRenew: false }])).toBeNull();
    expect(endsAtOf([])).toBeNull();
  });

  it('결제 실패 유예 기간엔 만료일을 유예 끝까지 늘려 둠', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const until = new Date(Date.now() + 45 * DAY);
    await t.service.applyStoreEvent({ kind: 'GRACE', originalTransactionId: 'orig-1', until });
    expect(t.purchases[0].iapExpiresAt).toEqual(until);
  });

  it('유예 중엔 결제 문제 표시(billingIssue), 결제가 되면 지움 + 다음 결제 예정일(2026-10-28)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await t.service.applyStoreEvent({ kind: 'GRACE', originalTransactionId: 'orig-1', until: new Date(Date.now() + 45 * DAY) });
    expect(t.purchases[0].billingIssueAt).toBeInstanceOf(Date);
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    expect(t.purchases[0].billingIssueAt).toBeNull();
  });

  it('다음 결제 예정일은 자동 갱신 예정인 스토어 구매 중 가장 이른 만료일', () => {
    const a = new Date('2026-11-01T00:00:00Z');
    const b = new Date('2026-11-10T00:00:00Z');
    expect(renewsAtOf([{ iapExpiresAt: b, willRenew: true }, { iapExpiresAt: a, willRenew: true }])).toEqual(a);
    expect(renewsAtOf([{ iapExpiresAt: a, willRenew: false }, { iapExpiresAt: b, willRenew: true }])).toEqual(b);
    expect(renewsAtOf([{ iapExpiresAt: null, willRenew: true }])).toBeNull();
  });

  it('만료 정리: 만료일이 유예(24시간)보다 더 지난 스토어 구매만 닫음', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const expiresAt = t.purchases[0].iapExpiresAt as Date;
    expect(await t.service.sweepExpired(new Date(expiresAt.getTime() + 60 * 60 * 1000))).toBe(0);
    expect(await t.service.sweepExpired(new Date(expiresAt.getTime() + 25 * 60 * 60 * 1000))).toBe(1);
    expect(t.open('a1')).toBeUndefined();
  });
});

describe('환불·회복·테스트 결제(2026-10-27)', () => {
  it('환불로 닫힌 구매는 같은 영수증을 다시 보내도(앱 확인·복원·옛 알림) 다시 열리지 않음', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    await t.service.applyStoreEvent({ kind: 'REFUNDED', originalTransactionId: 'orig-1', storeTransactionId: 'tx-1' });
    await expect(t.service.verifyPurchase('u', 'a1', t.iosDto)).rejects.toThrow('만료');
    expect((await t.service.restorePurchases('u', [t.iosDto])).results[0]).toMatchObject({ restored: false, code: 'IAP_EXPIRED' });
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt() })).toEqual({ applied: false });
    expect(t.open('a1')).toBeUndefined();
    // 환불 취소(REFUND_REVERSED)면 환불 표시를 지우고 다시 엶
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt(), refundReversed: true })).toEqual({ applied: true });
    expect(t.charges[0].refundedAt).toBeNull();
    expect(t.open('a1')).toBeTruthy();
    // 같은 구독의 새 결제(재구독)는 열림
    const t2 = setup();
    t2.receipt();
    await t2.service.verifyPurchase('u', 'a1', t2.iosDto);
    await t2.service.applyStoreEvent({ kind: 'REFUNDED', originalTransactionId: 'orig-1', storeTransactionId: 'tx-1' });
    await t2.service.applyStoreEvent({ kind: 'PAID', transaction: t2.receipt({ storeTransactionId: 'tx-2' }) });
    expect(t2.open('a1')).toBeTruthy();
  });

  it('유예 끝 만료 알림은 유예가 늘려 둔 만료일이 지났으면 반영(예전엔 옛 알림으로 버려짐)', async () => {
    const t = setup();
    t.receipt({ expiresAt: new Date(Date.now() + DAY) });
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const paidUntil = new Date(Date.now() - 16 * DAY);
    t.purchases[0].iapExpiresAt = new Date(Date.now() - 60 * 1000); // 유예 끝(방금 지남)
    expect(await t.service.applyStoreEvent({ kind: 'EXPIRED', originalTransactionId: 'orig-1', expiresAt: paidUntil })).toEqual({ applied: true });
    expect(t.open('a1')).toBeUndefined();
    const notified = appleStoreEvent({
      type: 'GRACE_PERIOD_EXPIRED',
      transaction: { platform: 'IOS', originalTransactionId: 'o', productId: 'p', purchasedAt: paidUntil, expiresAt: paidUntil },
      gracePeriodExpiresAt: t.purchases[0].iapExpiresAt as Date,
    });
    expect(notified).toMatchObject({ kind: 'EXPIRED', expiresAt: t.purchases[0].iapExpiresAt });
  });

  it('결제 실패로 닫힌 같은 구독이 회복되면 대화 시작 시점을 그대로(재구독은 새로)', async () => {
    const t = setup();
    t.receipt();
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    const startedAt = new Date('2026-01-01T00:00:00Z');
    t.subs[0].startedAt = startedAt;
    t.purchases[0].iapExpiresAt = new Date(Date.now() - 2 * DAY);
    expect(await t.service.sweepExpired()).toBe(1);
    // 두 번 돌아도(다른 서버) 해지 이력은 한 번
    expect(await t.service.sweepExpired()).toBe(0);
    expect(t.events.filter((e) => e === 'CANCELLED')).toHaveLength(1);
    await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt({ storeTransactionId: 'tx-2', recovered: true }) });
    expect(t.open('a1')?.startedAt).toEqual(startedAt);

    // 회복이 아닌 재구독은 지금부터
    const r = setup();
    r.receipt();
    await r.service.verifyPurchase('u', 'a1', r.iosDto);
    r.subs[0].startedAt = startedAt;
    r.purchases[0].iapExpiresAt = new Date(Date.now() - 2 * DAY);
    await r.service.sweepExpired();
    await r.service.applyStoreEvent({ kind: 'PAID', transaction: r.receipt({ storeTransactionId: 'tx-2' }) });
    expect(r.open('a1')?.startedAt).not.toEqual(startedAt);
  });

  it('구글 결제 대기는 방을 열지 않고, 결제된 구매는 서버가 확인(acknowledge)', async () => {
    const t = setup();
    const androidDto = { platform: 'ANDROID' as const, purchaseToken: 'pt', productId: 'toffee.a1' };
    t.receipt({ platform: 'ANDROID', originalTransactionId: 'pt', pending: true, needsAcknowledge: true });
    await expect(t.service.verifyPurchase('u', 'a1', androidDto)).rejects.toThrow('결제가 아직 끝나지 않았어요');
    expect(await t.service.applyStoreEvent({ kind: 'PAID', transaction: t.receipt({ platform: 'ANDROID', originalTransactionId: 'pt', pending: true }) })).toEqual({
      applied: false,
    });
    expect(t.purchases).toHaveLength(0);
    t.receipt({ platform: 'ANDROID', originalTransactionId: 'pt', needsAcknowledge: true });
    await t.service.verifyPurchase('u', 'a1', androidDto);
    expect(t.open('a1')).toBeTruthy();
    expect(t.acknowledged).toEqual(['pt']);
    const body = { orderId: 'GPA.1', expiryTimeMillis: '1792000000000', paymentState: 0, acknowledgementState: 0, purchaseType: 0 };
    expect(googleTransaction('pt', 'p', body, new Date())).toMatchObject({ pending: true, needsAcknowledge: true, sandbox: true });
  });

  it('애플 샌드박스(앱 심사) 결제는 방을 열되 결제 기록은 SANDBOX(정산 제외)', async () => {
    const t = setup();
    t.receipt({ sandbox: true });
    await t.service.verifyPurchase('u', 'a1', t.iosDto);
    expect(t.open('a1')).toBeTruthy();
    expect(t.charges[0].source).toBe('SANDBOX');
    expect(appleTransaction({ originalTransactionId: 'o', productId: 'p', expiresDate: 1, environment: 'Sandbox', revocationDate: 2 })).toMatchObject({
      sandbox: true,
      revoked: true,
    });
    expect(appleTransaction({ originalTransactionId: 'o', productId: 'p', expiresDate: 1, environment: 'Production' })?.sandbox).toBeUndefined();
  });
});

describe('스토어 알림 해석', () => {
  const tx: StoreTransaction = {
    platform: 'IOS',
    originalTransactionId: 'o',
    storeTransactionId: 't',
    productId: 'p',
    purchasedAt: new Date(),
    expiresAt: new Date(),
  };

  it('애플', () => {
    expect(appleStoreEvent({ type: 'DID_RENEW', transaction: tx }).kind).toBe('PAID');
    expect(appleStoreEvent({ type: 'SUBSCRIBED', subtype: 'RESUBSCRIBE', transaction: tx }).kind).toBe('PAID');
    expect(appleStoreEvent({ type: 'EXPIRED', subtype: 'VOLUNTARY', transaction: tx })).toEqual({ kind: 'EXPIRED', originalTransactionId: 'o', expiresAt: tx.expiresAt });
    expect(appleStoreEvent({ type: 'REFUND', transaction: tx })).toEqual({ kind: 'REFUNDED', originalTransactionId: 'o', storeTransactionId: 't' });
    const until = new Date();
    expect(appleStoreEvent({ type: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', transaction: tx, gracePeriodExpiresAt: until })).toEqual({
      kind: 'GRACE',
      originalTransactionId: 'o',
      until,
    });
    expect(appleStoreEvent({ type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_DISABLED', transaction: tx })).toEqual({
      kind: 'RENEWAL',
      originalTransactionId: 'o',
      willRenew: false,
    });
    expect(appleStoreEvent({ type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_ENABLED', transaction: tx })).toMatchObject({ kind: 'RENEWAL', willRenew: true });
    expect(appleStoreEvent({ type: 'TEST' }).kind).toBe('IGNORED');
    // 2026-10-27: 바로 올리기·환불 취소는 결제됨, 결제 실패 회복은 recovered, 내리기는 다음 갱신 때
    expect(appleStoreEvent({ type: 'DID_CHANGE_RENEWAL_PREF', subtype: 'UPGRADE', transaction: tx })).toEqual({ kind: 'PAID', transaction: tx });
    expect(appleStoreEvent({ type: 'DID_CHANGE_RENEWAL_PREF', transaction: tx }).kind).toBe('IGNORED');
    expect(appleStoreEvent({ type: 'REFUND_REVERSED', transaction: tx })).toEqual({ kind: 'PAID', transaction: tx, refundReversed: true });
    expect(appleStoreEvent({ type: 'DID_RENEW', subtype: 'BILLING_RECOVERY', transaction: tx })).toMatchObject({ kind: 'PAID', transaction: { recovered: true } });
  });

  it('구글', async () => {
    const fetch = async (token: string, productId: string) => ({ ...tx, platform: 'ANDROID' as const, originalTransactionId: token, productId });
    const sub = (notificationType: number) => ({ subscriptionNotification: { notificationType, purchaseToken: 'pt', subscriptionId: 'p' } });
    expect((await googleStoreEvent(sub(2), fetch)).kind).toBe('PAID');
    expect(await googleStoreEvent(sub(1), fetch)).toMatchObject({ kind: 'PAID', transaction: { recovered: true } });
    expect((await googleStoreEvent(sub(6), fetch)).kind).toBe('GRACE');
    expect(await googleStoreEvent(sub(13), fetch)).toMatchObject({ kind: 'EXPIRED', originalTransactionId: 'pt', expiresAt: tx.expiresAt });
    expect(await googleStoreEvent(sub(5), fetch)).toMatchObject({ kind: 'EXPIRED', originalTransactionId: 'pt' });
    expect(await googleStoreEvent(sub(3), fetch)).toEqual({ kind: 'RENEWAL', originalTransactionId: 'pt', willRenew: false });
    expect(await googleStoreEvent({ voidedPurchaseNotification: { purchaseToken: 'pt', orderId: 'GPA.1..2' } }, fetch)).toEqual({
      kind: 'REFUNDED',
      originalTransactionId: 'pt',
      storeTransactionId: 'GPA.1..2',
    });
  });

  it('구글 구독 응답: 갱신 결제는 orderId 끝의 ..N, 금액은 micros → 1/1000', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const first = googleTransaction('pt', 'p', { orderId: 'GPA.1', startTimeMillis: '1790000000000', expiryTimeMillis: '1792000000000', priceAmountMicros: '99000000' }, now);
    expect(first.purchasedAt.getTime()).toBe(1790000000000);
    expect(first.storeAmountMilli).toBe(99000);
    const renewal = googleTransaction('pt', 'p', { orderId: 'GPA.1..0', startTimeMillis: '1790000000000', expiryTimeMillis: '1794000000000' }, now);
    expect(renewal.purchasedAt).toBe(now);
    // 며칠 늦게 처음 기록된 갱신 — 만료일 한 달 전으로 추정(지금 시각이면 정산 달이 바뀜)
    const late = googleTransaction('pt', 'p', { orderId: 'GPA.1..1', expiryTimeMillis: String(Date.parse('2026-10-25T00:00:00Z')) }, now);
    expect(late.purchasedAt.toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });

  it('구글 첫 달 할인(도입 가격)은 할인 기간 결제만 할인 금액, 무료 체험은 0(2026-10-28)', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const base = {
      expiryTimeMillis: '1792000000000',
      priceAmountMicros: '149000000',
      priceCurrencyCode: 'THB',
      introductoryPriceInfo: { introductoryPriceAmountMicros: '99000000', introductoryPriceCurrencyCode: 'THB', introductoryPriceCycles: 1 },
    };
    expect(googleTransaction('pt', 'p', { ...base, orderId: 'GPA.1' }, now)).toMatchObject({ storeAmountMilli: 99000, storeCurrency: 'THB' });
    expect(googleTransaction('pt', 'p', { ...base, orderId: 'GPA.1..0' }, now).storeAmountMilli).toBe(149000);
    // 할인 2회면 두 번째 결제(..0)까지 할인
    const twoCycles = { ...base, introductoryPriceInfo: { ...base.introductoryPriceInfo, introductoryPriceCycles: 2 } };
    expect(googleTransaction('pt', 'p', { ...twoCycles, orderId: 'GPA.1..0' }, now).storeAmountMilli).toBe(99000);
    expect(googleTransaction('pt', 'p', { ...twoCycles, orderId: 'GPA.1..1' }, now).storeAmountMilli).toBe(149000);
    expect(googleTransaction('pt', 'p', { ...base, orderId: 'GPA.1', paymentState: 2, introductoryPriceInfo: undefined }, now).storeAmountMilli).toBe(0);
  });
});
