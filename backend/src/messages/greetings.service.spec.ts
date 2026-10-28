import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GreetingsService } from './greetings.service.js';
import { Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PushService } from '../notifications/push.service.js';
import type { ConfigService } from '@nestjs/config';

const config = { get: () => undefined } as unknown as ConfigService;

function setupBirthday(subscriptions: { actorId: string; notificationsMuted: boolean; userId: string }[]) {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue(subscriptions.map(({ userId }) => ({ id: userId }))),
    subscription: {
      findMany: vi.fn().mockResolvedValue(
        subscriptions.map(({ actorId, notificationsMuted, userId }) => ({
          actorId,
          notificationsMuted,
          user: { id: userId, nickname: null, displayName: userId },
          actor: { chatDisplayName: '캐러멜', birthdayMessage: '{{name}} 생일 축하해' },
        })),
      ),
    },
    birthdayGreeting: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
  const push = { sendToUser: vi.fn().mockResolvedValue(undefined) } as unknown as PushService;
  return { service: new GreetingsService(prisma, push, config), prisma, push };
}

describe('GreetingsService.sendBirthdayGreetings(2026-10-28)', () => {
  it('푸시 하나가 실패해도 나머지 팬의 축하 메시지는 계속 만듦', async () => {
    const { service, prisma, push } = setupBirthday([
      { actorId: 'a1', notificationsMuted: false, userId: 'u1' },
      { actorId: 'a1', notificationsMuted: false, userId: 'u2' },
    ]);
    vi.mocked(push.sendToUser).mockRejectedValueOnce(new Error('db down'));
    await expect(service.sendBirthdayGreetings(new Date('2026-10-28T03:00:00Z'))).resolves.toBe(2);
    expect(prisma.birthdayGreeting.create).toHaveBeenCalledTimes(2);
    expect(push.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('이 방 알림을 끈 팬은 축하 메시지만 만들고 푸시는 안 보냄', async () => {
    const { service, prisma, push } = setupBirthday([{ actorId: 'a1', notificationsMuted: true, userId: 'u1' }]);
    await expect(service.sendBirthdayGreetings(new Date('2026-10-28T03:00:00Z'))).resolves.toBe(1);
    expect(prisma.birthdayGreeting.create).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});

describe('GreetingsService 설정 — 없는 방(2026-10-28)', () => {
  it('운영자가 없는 방 id로 열면 500 대신 404', async () => {
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: Role.ADMIN }) },
      actor: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new GreetingsService(prisma, {} as PushService, config);
    await expect(service.settings('admin', 'nope')).rejects.toThrow(NotFoundException);
    await expect(service.updateSettings('admin', 'nope', { welcomeMessage: '안녕' })).rejects.toThrow(NotFoundException);
  });
});
