import { describe, expect, it, vi } from 'vitest';
import { BlocksService } from './blocks.service.js';
import { Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// 채널 차단 대상(2026-10-28) — 팬 + 다른 방을 팬으로 구독한 아티스트·소속사 계정. 운영자·이 방을 관리하는 계정은 안 됨
function setup(target: { role: Role; managesRoom?: boolean }) {
  const upsert = vi.fn().mockResolvedValue({});
  const users: Record<string, { id: string; role: Role; agencyId: string | null }> = {
    staff: { id: 'staff', role: Role.AGENCY_STAFF, agencyId: 'ag-1' },
    target: { id: 'target', role: target.role, agencyId: 'ag-2' },
  };
  const prisma = {
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(users[where.id] ?? null)),
      findUniqueOrThrow: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(users[where.id])),
    },
    // 관리자(staff)는 늘 이 방을 볼 수 있고, 대상은 managesRoom일 때만
    actor: { findFirst: vi.fn(({ where }: { where: { AND: [unknown, { OR: { selfUserId?: string }[] }] } }) => {
      const selfUserId = where.AND[1].OR[0].selfUserId;
      return Promise.resolve(selfUserId === 'staff' || target.managesRoom ? { id: 'actor-1' } : null);
    }) },
    message: { findFirst: vi.fn().mockResolvedValue(null) },
    actorFanBlock: { upsert, findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return { service: new BlocksService(prisma), upsert };
}

describe('BlocksService.block', () => {
  it('팬은 차단', async () => {
    const { service, upsert } = setup({ role: Role.USER });
    await service.block('staff', 'actor-1', 'target');
    expect(upsert).toHaveBeenCalled();
  });

  it('다른 방을 구독한 아티스트·소속사 계정도 차단', async () => {
    for (const role of [Role.ACTOR, Role.AGENCY_STAFF]) {
      const { service, upsert } = setup({ role });
      await service.block('staff', 'actor-1', 'target');
      expect(upsert).toHaveBeenCalled();
    }
  });

  it('운영자·이 방을 관리하는 계정은 거절', async () => {
    const admin = setup({ role: Role.ADMIN });
    await expect(admin.service.block('staff', 'actor-1', 'target')).rejects.toThrow();
    expect(admin.upsert).not.toHaveBeenCalled();
    const manager = setup({ role: Role.ACTOR, managesRoom: true });
    await expect(manager.service.block('staff', 'actor-1', 'target')).rejects.toThrow();
    expect(manager.upsert).not.toHaveBeenCalled();
  });
});
