import { describe, expect, it, vi } from 'vitest';
import { AdminActorsService } from './admin-actors.service.js';
import { roomRetireAt } from '../common/authorization/actor-access.js';

describe('활동 종료 예정(2026-10-20)', () => {
  it('CP방은 방·멤버 중 가장 이른 예정', () => {
    const early = new Date('2026-11-01T00:00:00Z');
    expect(roomRetireAt({ retireAt: null, coupleMembers: [{ member: { retireAt: new Date('2026-12-01') } }, { member: { retireAt: early } }] })).toEqual(early);
    expect(roomRetireAt({ retireAt: null, coupleMembers: [] })).toBeNull();
  });

  it('시각이 지난 예정만 종료하고(retiredAt = 예정 시각), 한 번만 알림', async () => {
    const due = new Date('2026-10-20T00:00:00Z');
    const prisma = {
      actor: {
        findMany: vi.fn().mockResolvedValue([{ id: 'a1', retireAt: due, chatDisplayName: 'A' }, { id: 'a2', retireAt: due, chatDisplayName: 'B' }]),
        // a2는 다른 서버가 먼저 처리함
        updateMany: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve({ count: where.id === 'a1' ? 1 : 0 })),
      },
      coupleMember: { findMany: vi.fn().mockResolvedValue([]) },
      subscription: { findMany: vi.fn().mockResolvedValue([{ userId: 'fan' }]) },
    };
    const push = { sendToUsers: vi.fn().mockResolvedValue(undefined) };
    const service = new AdminActorsService(prisma as never, {} as never, {} as never, {} as never, {} as never, push as never, {} as never, {} as never, { notify: vi.fn() } as never);
    await service.retireDue(new Date('2026-10-20T00:01:00Z'));
    expect(prisma.actor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { retireAt: { lte: new Date('2026-10-20T00:01:00Z') }, retiredAt: null } }));
    expect(prisma.actor.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', retiredAt: null }, data: { retiredAt: due, retireAt: null } });
    expect(push.sendToUsers).toHaveBeenCalledTimes(1);
    expect(push.sendToUsers.mock.calls[0][2]).toEqual({ type: 'actor-retired', actorId: 'a1' });
  });
});
