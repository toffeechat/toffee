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
    expect(prisma.actor.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', retiredAt: null, retireAt: due }, data: { retiredAt: due, retireAt: null } });
    expect(push.sendToUsers).toHaveBeenCalledTimes(1);
    expect(push.sendToUsers.mock.calls[0][2]).toEqual({ type: 'actor-retired', actorId: 'a1' });
  });

  const make = (prisma: Record<string, unknown>, audit = { record: vi.fn().mockResolvedValue(undefined) }, agencies: Record<string, unknown> = {}) =>
    new AdminActorsService(prisma as never, {} as never, {} as never, agencies as never, audit as never, { sendToUsers: vi.fn() } as never, {} as never, {} as never, { notify: vi.fn() } as never);

  it('이미 종료된 아티스트에 종료를 또 보내면 retiredAt을 그대로 둠(14일 환불 기간이 밀리지 않게, 2026-10-27)', async () => {
    const update = vi.fn();
    const audit = { record: vi.fn() };
    const service = make({ actor: { findUnique: vi.fn().mockResolvedValue({ id: 'a1', retiredAt: new Date('2026-10-01'), chatDisplayName: 'A' }), update } }, audit);
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.setRetired('admin', 'a1', true);
    expect(update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('수정 저장 때 공개 시각이 그대로면 공개 알림 기록(releaseNotifiedAt)을 지우지 않음(2026-10-27)', async () => {
    const releaseAt = new Date('2026-10-10T00:00:00Z');
    const update = vi.fn();
    const service = make({
      actor: { findUnique: vi.fn().mockResolvedValue({ monthlyPriceCents: 14900, storeProductId: null, kind: 'SOLO', releaseAt }), update },
      bundle: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.update('admin', 'a1', { releaseAt: releaseAt.toISOString(), chatDisplayName: 'B' } as never);
    expect(update.mock.calls[0][0].data).not.toHaveProperty('releaseNotifiedAt');
    await service.update('admin', 'a1', { releaseAt: '2026-11-01T00:00:00.000Z' } as never);
    expect(update.mock.calls[1][0].data).toMatchObject({ releaseAt: new Date('2026-11-01T00:00:00Z'), releaseNotifiedAt: null });
  });

  it('아티스트 등록·본인 계정 연결은 작업 기록에 남음(2026-10-27)', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const assignActor = vi.fn().mockResolvedValue({});
    const service = make(
      {
        actor: {
          create: vi.fn().mockResolvedValue({ id: 'new' }),
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; selfUserId?: string } }) =>
            Promise.resolve(where.selfUserId ? null : { id: 'a1', retiredAt: null, chatDisplayName: 'A' }),
          ),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ kind: 'SOLO', selfUserId: null }),
          update: vi.fn(),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ role: 'ACTOR' }) },
      },
      audit,
      { assignActor },
    );
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.create('admin', { legalName: ' 카라멜 ', chatDisplayName: 'Caramel', monthlyPriceCents: 14900, agencyId: 'ag1' } as never);
    expect(assignActor).toHaveBeenCalledWith('admin', 'new', 'ag1');
    expect(audit.record).toHaveBeenCalledWith('admin', 'ACTOR_CREATE', 'ACTOR', 'new', expect.objectContaining({ legalName: '카라멜', agencyId: 'ag1' }));
    await service.linkUser('admin', 'a1', 'u9');
    expect(audit.record).toHaveBeenCalledWith('admin', 'ACTOR_SELF_LINK', 'ACTOR', 'a1', { from: null, to: 'u9' });
  });
});
