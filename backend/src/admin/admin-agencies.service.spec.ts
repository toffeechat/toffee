import { describe, expect, it, vi } from 'vitest';
import { AdminAgenciesService } from './admin-agencies.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { AuditService } from '../audit/audit.service.js';

describe('소속·소속사 등록 작업 기록(2026-10-27)', () => {
  const setup = (prisma: Record<string, unknown>) => {
    const record = vi.fn().mockResolvedValue(undefined);
    const media = { resolveImageUrl: vi.fn().mockResolvedValue(null) };
    const service = new AdminAgenciesService(prisma as unknown as PrismaService, media as unknown as MediaService, { record } as unknown as AuditService);
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
