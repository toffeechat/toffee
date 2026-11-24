import { describe, expect, it, vi } from 'vitest';
import { PrismaThrottlerStorage } from './prisma-throttler.storage.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

const at = (msFromNow: number, now: Date) => new Date(now.getTime() + msFromNow);

describe('PrismaThrottlerStorage(점검 5차 — 요청 제한 기록을 DB에)', () => {
  it('DB가 센 횟수로 한도를 넘으면 막고, 막힐 때 blockedUntil을 기록함', async () => {
    const now = new Date('2026-11-24T00:00:00Z');
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ hits: 3, expiresAt: at(30_000, now), blockedUntil: null, now }])
      .mockResolvedValueOnce([{ blockedUntil: at(60_000, now) }]);
    const storage = new PrismaThrottlerStorage({ $queryRaw: queryRaw } as unknown as PrismaService);
    await expect(storage.increment('k', 60_000, 2, 60_000, 'default')).resolves.toEqual({ totalHits: 3, timeToExpire: 30, isBlocked: true, timeToBlockExpire: 60 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('한도 안이면 막지 않음', async () => {
    const now = new Date('2026-11-24T00:00:00Z');
    const queryRaw = vi.fn().mockResolvedValueOnce([{ hits: 1, expiresAt: at(60_000, now), blockedUntil: null, now }]);
    const storage = new PrismaThrottlerStorage({ $queryRaw: queryRaw } as unknown as PrismaService);
    await expect(storage.increment('k', 60_000, 2, 60_000, 'default')).resolves.toMatchObject({ totalHits: 1, isBlocked: false, timeToBlockExpire: 0 });
  });

  it('DB 오류면 서버 메모리로 넘어가 요청을 막지 않음', async () => {
    const storage = new PrismaThrottlerStorage({ $queryRaw: vi.fn().mockRejectedValue(new Error('db down')) } as unknown as PrismaService);
    const first = await storage.increment('k', 60_000, 2, 60_000, 'default');
    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
  });
});
