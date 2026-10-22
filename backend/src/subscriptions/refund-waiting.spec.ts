import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { RefundService, storeRefundWaitingWhere } from './refund.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { IapVerificationService } from './iap-verification.service.js';
import type { ChargeLedgerService } from '../settlements/charge-ledger.service.js';

const NOW = new Date('2026-10-22T00:00:00Z');

function makeService(prisma: unknown, config: Record<string, string> = {}) {
  return new RefundService(
    prisma as PrismaService,
    { get: (key: string) => config[key] } as unknown as ConfigService,
    {} as IapVerificationService,
    {} as ChargeLedgerService,
  );
}

describe('환불 처리 대기(2026-10-22)', () => {
  it('애플 안내 + 아직 환불 안 됨 + 안내한 지 3일 넘음 + 확인 안 함만 대기', () => {
    expect(storeRefundWaitingWhere(NOW, 3)).toEqual({
      status: 'STORE_GUIDED',
      checkedAt: null,
      createdAt: { lte: new Date('2026-10-19T00:00:00Z') },
      charge: { refundedAt: null },
    });
  });

  it('기준 날 수는 서버 설정 APPLE_REFUND_WAIT_DAYS로 바꿀 수 있음(기본 3)', () => {
    expect(makeService({}).appleWaitDays).toBe(3);
    expect(makeService({}, { APPLE_REFUND_WAIT_DAYS: '5' }).appleWaitDays).toBe(5);
  });

  it('목록에 대기 여부를 붙임 — 3일 안 지났거나 애플이 환불했거나 확인한 건 대기 아님', async () => {
    const charge = (refundedAt: Date | null) => ({ id: 'c', productName: 'A', amountCents: 14900, chargedAt: NOW, periodEnd: NOW, refundedAt, allocations: [] });
    const row = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
      id,
      userId: 'fan',
      reason: 'STAR_IDLE',
      source: 'APPLE',
      status: 'STORE_GUIDED',
      createdAt: new Date(createdAt),
      checkedAt: null,
      checkedById: null,
      checkedNote: null,
      charge: charge(null),
      ...extra,
    });
    const rows = [
      row('old', '2026-10-18T00:00:00Z'),
      row('recent', '2026-10-21T00:00:00Z'),
      row('refunded', '2026-10-10T00:00:00Z', { charge: charge(NOW) }),
      row('checked', '2026-10-10T00:00:00Z', { checkedAt: NOW, checkedById: 'admin', checkedNote: '애플 거절' }),
      row('ours', '2026-10-10T00:00:00Z', { status: 'REFUNDED', source: 'GOOGLE' }),
    ];
    const prisma = {
      refundRequest: { findMany: vi.fn().mockResolvedValue(rows) },
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'admin', displayName: '운영자', nickname: null, email: null }]) },
    };
    const list = await makeService(prisma).adminList({}, NOW);
    expect(Object.fromEntries(list.map((entry) => [entry.id, entry.waiting]))).toEqual({ old: true, recent: false, refunded: false, checked: false, ours: false });
    expect(list.find((entry) => entry.id === 'checked')).toMatchObject({ checkedBy: '운영자', checkedNote: '애플 거절' });
  });

  it('확인함 — 메모와 함께 기록, 애플 안내 건이 아니면 찾을 수 없음', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'r1', checkedAt: NOW });
    const findUnique = vi.fn().mockResolvedValueOnce({ status: 'STORE_GUIDED', checkedAt: null }).mockResolvedValueOnce({ status: 'REFUNDED', checkedAt: null });
    const service = makeService({ refundRequest: { findUnique, update } });
    await service.markChecked('admin', 'r1', '  팬이 애플에 요청 안 함 ');
    expect(update.mock.calls[0][0].data).toMatchObject({ checkedById: 'admin', checkedNote: '팬이 애플에 요청 안 함' });
    await expect(service.markChecked('admin', 'r2')).rejects.toThrow();
  });
});
