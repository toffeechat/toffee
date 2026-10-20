import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseService } from './release.service.js';
import { bundleOpensAt, isReleased } from '../common/release/release.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PushService } from '../notifications/push.service.js';

const NOW = new Date('2026-11-01T13:00:00Z');
const past = new Date(NOW.getTime() - 60_000);
const future = new Date(NOW.getTime() + 60_000);

function make(options: { actors?: unknown[]; bundles?: unknown[]; claim?: number; releaseAt?: Date | null } = {}) {
  const prisma = {
    actor: {
      findMany: vi.fn().mockResolvedValue(options.actors ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: options.claim ?? 1 }),
      findUnique: vi.fn().mockResolvedValue({ releaseAt: options.releaseAt ?? null }),
    },
    bundle: {
      findMany: vi.fn().mockResolvedValue(options.bundles ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: options.claim ?? 1 }),
    },
    releaseWatch: {
      findMany: vi.fn().mockResolvedValue([{ userId: 'fan-1' }, { userId: 'fan-2' }]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const push = { sendToUsers: vi.fn().mockResolvedValue(undefined) };
  const service = new ReleaseService(prisma as unknown as PrismaService, push as unknown as PushService);
  return { service, prisma, push };
}

describe('공개 예정·예약 오픈', () => {
  it('공개 판단: 시각이 없거나 지났으면 공개, 묶음은 가장 늦은 공개 시각', () => {
    expect(isReleased(null, NOW)).toBe(true);
    expect(isReleased(past, NOW)).toBe(true);
    expect(isReleased(NOW, NOW)).toBe(true);
    expect(isReleased(future, NOW)).toBe(false);
    expect(bundleOpensAt(null, [null, null])).toBeNull();
    expect(bundleOpensAt(past, [future, null])).toEqual(future);
  });

  it('정각 알림: 먼저 잡은 서버만 알림 받기 팬에게 공식 이름으로 푸시, 활동 종료한 방은 표시만', async () => {
    const { service, prisma, push } = make({
      actors: [
        { id: 'a1', releaseAt: past, legalName: 'Bright', retiredAt: null },
        { id: 'a2', releaseAt: past, legalName: 'Gone', retiredAt: past },
      ],
    });
    expect(await service.notifyDue(NOW)).toBe(1);
    expect(prisma.actor.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', releaseAt: past, releaseNotifiedAt: null }, data: { releaseNotifiedAt: NOW } });
    expect(push.sendToUsers).toHaveBeenCalledOnce();
    const [userIds, compose, data] = push.sendToUsers.mock.calls[0];
    expect(userIds).toEqual(['fan-1', 'fan-2']);
    expect(compose({ locale: 'ko' })).toEqual({ title: 'Bright', body: '지금 토피룸이 열렸어요! 가장 먼저 만나 보세요' });
    expect(data).toEqual({ type: 'actor-released', actorId: 'a1' });
  });

  it('다른 서버가 먼저 잡았으면 안 보냄', async () => {
    const { service, push } = make({ actors: [{ id: 'a1', releaseAt: past, legalName: 'Bright', retiredAt: null }], claim: 0 });
    expect(await service.notifyDue(NOW)).toBe(0);
    expect(push.sendToUsers).not.toHaveBeenCalled();
  });

  it('묶음: 든 방이 아직 공개 전이면 기다렸다가, 열리면 묶음 이름으로', async () => {
    const waiting = make({ bundles: [{ id: 'b1', releaseAt: past, name: 'BrightWin', active: true, actors: [{ actor: { releaseAt: future } }] }] });
    expect(await waiting.service.notifyDue(NOW)).toBe(0);
    expect(waiting.prisma.bundle.updateMany).not.toHaveBeenCalled();

    const open = make({ bundles: [{ id: 'b1', releaseAt: null, name: 'BrightWin', active: true, actors: [{ actor: { releaseAt: past } }] }] });
    expect(await open.service.notifyDue(NOW)).toBe(1);
    expect(open.push.sendToUsers.mock.calls[0][2]).toEqual({ type: 'bundle-released', bundleId: 'b1' });
  });

  it('알림 받기: 공개 전에만, 두 번 눌러도 한 줄', async () => {
    const { service, prisma } = make({ releaseAt: new Date(Date.now() + 3_600_000) });
    expect(await service.watch('fan-1', { actorId: 'a1' })).toEqual({ watching: true });
    expect(prisma.releaseWatch.create).toHaveBeenCalledWith({ data: { userId: 'fan-1', actorId: 'a1' } });
    prisma.releaseWatch.findFirst.mockResolvedValue({ id: 'w1' });
    await service.watch('fan-1', { actorId: 'a1' });
    expect(prisma.releaseWatch.create).toHaveBeenCalledOnce();

    const opened = make({ releaseAt: null });
    await expect(opened.service.watch('fan-1', { actorId: 'a1' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
