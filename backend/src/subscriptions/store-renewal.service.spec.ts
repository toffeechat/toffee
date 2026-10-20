import { describe, expect, it, vi } from 'vitest';
import { StoreRenewalService, shouldStopNow } from './store-renewal.service.js';

describe('활동 종료 때 스토어 갱신 멈추기(2026-10-20)', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const solo = (retiredAt: string | null, retireAt: string | null) => ({ retiredAt: retiredAt ? new Date(retiredAt) : null, retireAt: retireAt ? new Date(retireAt) : null });

  it('종료됐으면 바로, 종료 예정이면 지금 낸 기간이 예정일을 넘을 때만(예정일 전 갱신은 그대로)', () => {
    expect(shouldStopNow(solo('2026-10-19T00:00:00Z', null), new Date('2026-11-01'), now)).toBe(true);
    expect(shouldStopNow(solo(null, '2026-12-01T00:00:00Z'), new Date('2026-11-01'), now)).toBe(false);
    expect(shouldStopNow(solo(null, '2026-12-01T00:00:00Z'), new Date('2026-12-05'), now)).toBe(true);
    expect(shouldStopNow(solo(null, null), new Date('2026-12-05'), now)).toBe(false);
    // CP방은 멤버 예정도
    expect(shouldStopNow({ ...solo(null, null), coupleMembers: [{ member: solo(null, '2026-11-10T00:00:00Z') }] }, new Date('2026-11-15'), now)).toBe(true);
  });

  it('해지에 성공한 구독만 갱신 꺼짐으로, 실패는 다음에 다시', async () => {
    const prisma = {
      purchase: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', iapTransactionId: 't1', iapExpiresAt: new Date('2026-11-01'), actor: { ...solo('2026-10-19T00:00:00Z', null), coupleMembers: [] }, bundle: null },
          { id: 'p2', iapTransactionId: 't2', iapExpiresAt: new Date('2026-11-01'), actor: { ...solo('2026-10-19T00:00:00Z', null), coupleMembers: [] }, bundle: null },
          // 예정일 전 갱신 — 아직 두기
          { id: 'p3', iapTransactionId: 't3', iapExpiresAt: new Date('2026-11-01'), actor: null, bundle: { actors: [{ actor: { ...solo(null, '2026-12-01T00:00:00Z'), coupleMembers: [] } }] } },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const iap = { cancelGoogleSubscription: vi.fn((token: string) => (token === 't2' ? Promise.reject(new Error('500')) : Promise.resolve(true))) };
    const service = new StoreRenewalService(prisma as never, iap as never);
    expect(await service.stopGoogleRenewals(now)).toBe(1);
    expect(iap.cancelGoogleSubscription.mock.calls.map((call) => call[0])).toEqual(['t1', 't2']);
    expect(prisma.purchase.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { willRenew: false } });
  });
});
