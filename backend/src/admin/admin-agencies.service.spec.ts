import { describe, expect, it, vi } from 'vitest';
import { AdminAgenciesService } from './admin-agencies.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ConfigService } from '@nestjs/config';

describe('소속·소속사 등록 작업 기록(2026-10-27)', () => {
  const setup = (prisma: Record<string, unknown>) => {
    const record = vi.fn().mockResolvedValue(undefined);
    const media = { resolveImageUrl: vi.fn().mockResolvedValue(null) };
    const service = new AdminAgenciesService(prisma as unknown as PrismaService, media as unknown as MediaService, { record } as unknown as AuditService, { get: () => undefined } as unknown as ConfigService);
    return { service, record };
  };

  it('아티스트 소속이 바뀌면 from/to 기록, 그대로면 기록 없음', async () => {
    const tx = {
      actor: {
        findUnique: vi.fn().mockResolvedValue({ agencyId: 'old', kind: 'SOLO' }),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'a1' }),
      },
      actorAgencyHistory: { updateMany: vi.fn(), create: vi.fn() },
    };
    const prisma = { agency: { findUnique: vi.fn().mockResolvedValue({ id: 'new' }) }, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    const { service, record } = setup(prisma);
    await service.assignActor('admin', 'a1', 'new');
    expect(record).toHaveBeenCalledWith('admin', 'ACTOR_AGENCY', 'ACTOR', 'a1', { from: 'old', to: 'new' });
    record.mockClear();
    await service.assignActor('admin', 'a1', 'old');
    expect(record).not.toHaveBeenCalled();
  });

  it('직원 소속 지정·소속사 만들기도 기록', async () => {
    const prisma = {
      agency: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string } }) => Promise.resolve(where.id ? { id: where.id } : null)),
        create: vi.fn().mockResolvedValue({ id: 'ag9', name: '새 소속사', logoUrl: null, revenueSharePercent: null, createdAt: new Date(), _count: { actors: 0, staff: 0 } }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'AGENCY_STAFF', agencyId: null }), update: vi.fn().mockResolvedValue({ id: 'u1' }) },
    };
    const { service, record } = setup(prisma);
    await service.assignStaff('admin', 'u1', 'ag1');
    expect(record).toHaveBeenCalledWith('admin', 'STAFF_AGENCY', 'USER', 'u1', { from: null, to: 'ag1' });
    await service.create('admin', { name: ' 새 소속사 ' } as never);
    expect(record).toHaveBeenCalledWith('admin', 'AGENCY_CREATE', 'AGENCY', 'ag9', { name: '새 소속사' });
  });
});

describe('배분율 이력 API(2026-10-27)', () => {
  type Row = { agencyId: string; fromMonth: string; percent: number | null; createdAt: Date };
  const setup = (lastClosed: string | null, initial: Row[] = []) => {
    const rows = [...initial];
    const agencyUpdates: unknown[] = [];
    const upsert = vi.fn(async ({ where, create, update }: { where: { agencyId_fromMonth: { agencyId: string; fromMonth: string } }; create: Row; update: { percent: number | null } }) => {
      const found = rows.find((r) => r.agencyId === where.agencyId_fromMonth.agencyId && r.fromMonth === where.agencyId_fromMonth.fromMonth);
      if (found) found.percent = update.percent;
      else rows.push({ ...create, createdAt: new Date() });
    });
    const agencyShareRate = {
      upsert,
      findMany: async () => [...rows].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth)),
      findFirst: async ({ where }: { where: { fromMonth: { lte: string } } }) =>
        rows.filter((r) => r.fromMonth <= where.fromMonth.lte).sort((a, b) => b.fromMonth.localeCompare(a.fromMonth))[0] ?? null,
      findUnique: async ({ where }: { where: { agencyId_fromMonth: { fromMonth: string } } }) => rows.find((r) => r.fromMonth === where.agencyId_fromMonth.fromMonth) ?? null,
      delete: async ({ where }: { where: { agencyId_fromMonth: { fromMonth: string } } }) => rows.splice(rows.findIndex((r) => r.fromMonth === where.agencyId_fromMonth.fromMonth), 1),
    };
    const prisma = {
      agency: {
        findUnique: async () => ({ id: 'ag', revenueSharePercent: null, logoUrl: null }),
        update: async ({ data }: { data: unknown }) => {
          agencyUpdates.push(data);
          return { id: 'ag', name: 'A', logoUrl: null, revenueSharePercent: null, createdAt: new Date(), _count: { actors: 0, staff: 0 } };
        },
      },
      agencyShareRate,
      settlementClose: { findFirst: async () => (lastClosed ? { month: lastClosed } : null) },
      $transaction: (fn: (tx: unknown) => unknown) => fn({ agencyShareRate }),
    };
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new AdminAgenciesService(
      prisma as unknown as PrismaService,
      { resolveImageUrl: vi.fn().mockResolvedValue(null) } as unknown as MediaService,
      { record } as unknown as AuditService,
      { get: () => undefined } as unknown as ConfigService,
    );
    return { service, rows, record, agencyUpdates, upsert };
  };
  const now = new Date('2027-03-10T00:00:00Z');

  it('마감한 달(마지막 마감 달까지)은 바꾸기·지우기·창립 파트너 모두 거절', async () => {
    const t = setup('2027-02', [{ agencyId: 'ag', fromMonth: '2027-01', percent: 70, createdAt: now }]);
    await expect(t.service.setShareRate('admin', 'ag', { fromMonth: '2027-02', percent: 60 }, now)).rejects.toThrow('2027-02');
    await expect(t.service.deleteShareRate('admin', 'ag', '2027-01', now)).rejects.toThrow('마감');
    await expect(t.service.applyFoundingShare('admin', 'ag', { fromMonth: '2026-12' }, now)).rejects.toThrow('마감');
    await expect(t.service.setShareRate('admin', 'ag', { fromMonth: '2027-3', percent: 60 }, now)).rejects.toThrow();
    expect(t.upsert).not.toHaveBeenCalled();
    expect(t.record).not.toHaveBeenCalled();
  });

  it('열린 달부터 바꾸면 기록·이번 달 비율 동기화, 앞으로의 달은 예약', async () => {
    const t = setup('2027-02', [{ agencyId: 'ag', fromMonth: '2027-01', percent: 70, createdAt: now }]);
    const result = await t.service.setShareRate('admin', 'ag', { fromMonth: '2027-03', percent: 65 }, now);
    expect(result).toMatchObject({ currentMonth: '2027-03', currentPercent: 65, lastClosedMonth: '2027-02' });
    expect(t.record).toHaveBeenCalledWith('admin', 'AGENCY_SHARE', 'AGENCY', 'ag', { fromMonth: '2027-03', from: 70, to: 65 });
    expect(t.agencyUpdates.at(-1)).toEqual({ revenueSharePercent: 65 });
    await t.service.setShareRate('admin', 'ag', { fromMonth: '2027-06', percent: null }, now);
    expect(t.agencyUpdates.at(-1)).toEqual({ revenueSharePercent: 65 });
    const afterDelete = await t.service.deleteShareRate('admin', 'ag', '2027-03', now);
    expect(afterDelete.currentPercent).toBe(70);
    expect(afterDelete.rates.map((r) => r.fromMonth)).toEqual(['2027-01', '2027-06']);
  });

  it('창립 파트너 — 시작 달 70%, 12개월 뒤 기본값 두 줄', async () => {
    const t = setup(null);
    const result = await t.service.applyFoundingShare('admin', 'ag', { fromMonth: '2027-02' }, now);
    expect(t.rows.map((r) => [r.fromMonth, r.percent])).toEqual([
      ['2027-02', 70],
      ['2028-02', null],
    ]);
    expect(result.currentPercent).toBe(70);
    expect(t.agencyUpdates.at(-1)).toEqual({ revenueSharePercent: 70 });
    expect(t.record).toHaveBeenCalledWith('admin', 'AGENCY_SHARE', 'AGENCY', 'ag', expect.objectContaining({ founding: true, fromMonth: '2027-02', afterMonth: '2028-02', foundingPercent: 70, afterPercent: null }));
  });

  it('옛 화면의 배분율 한 칸(PATCH)은 이번 달부터 이력 한 줄', async () => {
    const t = setup('2026-09');
    await t.service.update('admin', 'ag', { revenueSharePercent: 70 });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0].percent).toBe(70);
    expect(t.record).toHaveBeenCalledWith('admin', 'AGENCY_SHARE', 'AGENCY', 'ag', expect.objectContaining({ from: null, to: 70 }));
  });
});
