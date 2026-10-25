import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEach = vi.fn();
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEach }) }));
vi.mock('firebase-admin/app', () => ({ cert: vi.fn(), getApps: () => [{}], initializeApp: vi.fn() }));

const { PushService, buildPushMessages, chunk } = await import('./push.service.js');
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { ShutdownService } from '../common/lifecycle/shutdown.service.js';

const shutdown = new ShutdownService({ getCronJobs: () => new Map() } as unknown as SchedulerRegistry);

function setup(deviceCount: number) {
  const devices = Array.from({ length: deviceCount }, (_, i) => ({
    token: `t${i}`,
    user: { locale: i % 2 ? 'th' : 'ko', displayName: `fan${i}` },
  }));
  const prisma = {
    pushDevice: { findMany: vi.fn().mockResolvedValue(devices), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const config = { get: () => '{}' } as unknown as ConfigService;
  const service = new PushService(config, prisma as unknown as PrismaService, shutdown);
  service.onModuleInit();
  return { service, prisma };
}

describe('PushService', () => {
  beforeEach(() => {
    sendEach.mockReset();
  });

  it('기기마다 받는 사람 언어·이름으로 문구를 만든다', () => {
    const messages = buildPushMessages(
      [
        { token: 'a', user: { locale: 'ko', displayName: '민지' } },
        { token: 'b', user: { locale: 'th', displayName: 'Fah' } },
      ],
      ({ locale, displayName }) => ({ title: 'T', body: `${locale}:${displayName}` }),
      { actorId: 'x' },
    );
    expect(messages.map((m) => (m as { notification: { body: string } }).notification.body)).toEqual(['ko:민지', 'th:Fah']);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('안 읽은 수가 있으면 아이폰·안드로이드 앱 아이콘 숫자로, 없으면 숫자를 건드리지 않음(2026-10-15)', () => {
    const [withBadge, without] = buildPushMessages(
      [
        { token: 'a', user: { locale: 'ko', displayName: '민지' }, badge: 3 },
        { token: 'b', user: { locale: 'ko', displayName: '수아' } },
      ],
      () => ({ title: 'T', body: 'B' }),
    ) as unknown as { apns: { payload: { aps: Record<string, unknown> } }; android: { notification: Record<string, unknown> } }[];
    expect(withBadge.apns.payload.aps.badge).toBe(3);
    expect(withBadge.android.notification.notificationCount).toBe(3);
    expect(without.apns.payload.aps).not.toHaveProperty('badge');
    expect(without.android.notification).not.toHaveProperty('notificationCount');
  });

  it('1,200개 기기는 500개씩 3번에 나눠 보내고, 죽은 토큰만 지운다', async () => {
    const { service, prisma } = setup(1200);
    sendEach.mockImplementation((batch: unknown[]) =>
      Promise.resolve({
        failureCount: 1,
        responses: batch.map((_, i) =>
          i === 0 ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true },
        ),
      }),
    );
    await service.sendToUsers(['u1'], () => ({ title: 't', body: 'b' }));
    expect(sendEach.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([500, 500, 200]);
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ['t0', 't500', 't1000'] } } });
  });

  it('발송 자체가 실패해도 예외를 던지지 않는다(best-effort)', async () => {
    const { service } = setup(3);
    sendEach.mockRejectedValue(new Error('network'));
    await expect(service.sendToUsers(['u1'], () => ({ title: 't', body: 'b' }))).resolves.toBeUndefined();
  });
});

describe('PushService 받는 사람 거르기', () => {
  it('정지(기간 중)·영구차단·탈퇴한 계정의 기기는 조회에서 제외', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { pushDevice: { findMany, deleteMany: vi.fn() } } as unknown as PrismaService;
    const service = new PushService({ get: () => '{}' } as unknown as ConfigService, prisma, shutdown);
    service.onModuleInit();
    await service.sendToUsers(['u1'], () => ({ title: 't', body: 'b' }));
    const where = findMany.mock.calls[0][0].where;
    expect(where.user.deletedAt).toBeNull();
    expect(where.user.OR).toEqual([{ status: 'ACTIVE' }, { status: 'SUSPENDED', suspendedUntil: { lte: expect.any(Date) } }]);
  });
});

// 배포 때(SIGTERM) 보내던 푸시가 끝날 때까지 기다리도록 — 기다리지 않고(void) 보낸 발송도 ShutdownService에 잡혀 있어야 함(2026-10-25)
describe('PushService 종료 대기', () => {
  it('보내는 동안은 백그라운드 작업으로 잡히고, 끝나면 빠짐', async () => {
    sendEach.mockReset();
    const { service } = setup(3);
    let release!: () => void;
    sendEach.mockReturnValueOnce(new Promise((resolve) => (release = () => resolve({ failureCount: 0, responses: [] }))));
    const sending = service.sendToUsers(['u1'], () => ({ title: 't', body: 'b' }));
    expect(shutdown.pending().tasks).toBe(1);
    await vi.waitFor(() => expect(sendEach).toHaveBeenCalled());
    release();
    await sending;
    expect(shutdown.pending().tasks).toBe(0);
  });
});
