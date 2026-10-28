import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';

// LISTEN 전용 연결을 가짜로 — 만들어진 연결을 모아 두고 끊김('end')을 흉내 냄
const clients: FakeClient[] = [];
class FakeClient extends EventEmitter {
  connect = vi.fn().mockResolvedValue(undefined);
  query = vi.fn().mockResolvedValue(undefined);
  end = vi.fn().mockResolvedValue(undefined);
  constructor() {
    super();
    clients.push(this);
  }
}
vi.mock('pg', () => ({ default: { Client: FakeClient } }));

const { RealtimeService } = await import('./realtime.service.js');
const { RealtimeController } = await import('./realtime.controller.js');

function setup() {
  const config = { getOrThrow: () => 'postgres://test' } as unknown as ConfigService;
  return new RealtimeService({} as PrismaService, config);
}

afterEach(() => {
  clients.length = 0;
  vi.useRealTimers();
});

describe('RealtimeService LISTEN 재연결(2026-10-25)', () => {
  it('처음 연결엔 아무것도 안 보내고, 끊겼다 다시 붙으면 resync — 그 사이 놓친 신호를 앱이 다시 불러오게', async () => {
    vi.useFakeTimers();
    const realtime = setup();
    const events: string[] = [];
    realtime.events$.subscribe((event) => events.push(event.kind));
    realtime.onModuleInit();
    await vi.waitFor(() => expect(clients[0]?.query).toHaveBeenCalledWith('LISTEN toffee_realtime'));
    expect(events).toEqual([]);

    clients[0].emit('end');
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(clients[1]?.query).toHaveBeenCalled());
    expect(events).toEqual(['resync']);
    await realtime.onModuleDestroy();
  });

  it('closeStreams: 새 연결을 안 받고 열린 SSE에 끝 신호(LISTEN은 유지)', async () => {
    const realtime = setup();
    let closed = false;
    realtime.streamsClosed$.subscribe({ complete: () => (closed = true) });
    expect(realtime.acceptingStreams).toBe(true);
    realtime.closeStreams();
    realtime.closeStreams();
    expect(realtime.acceptingStreams).toBe(false);
    expect(closed).toBe(true);
    await realtime.onModuleDestroy();
  });
});

describe('RealtimeController 배포·재동기화(2026-10-25)', () => {
  function controller(realtime: InstanceType<typeof RealtimeService>) {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'fan', role: 'USER', agencyId: null, status: 'ACTIVE', deletedAt: null, suspendedUntil: null, tokenVersion: 0, authSessions: [] }) },
      subscription: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    return new RealtimeController(realtime, prisma);
  }
  const fan = { id: 'fan' } as never;

  it('resync는 구독과 상관없이 모든 연결에 감, 배포 시작이면 연결을 닫음', async () => {
    const realtime = setup();
    const received: string[] = [];
    let completed = false;
    controller(realtime)
      .stream(fan)
      .subscribe({ next: (event) => received.push(event.type as string), complete: () => (completed = true) });
    await vi.waitFor(() => expect(received).toContain('ready'));
    (realtime as unknown as { subject: { next: (event: object) => void } }).subject.next({ kind: 'resync' });
    expect(received).toEqual(['ready', 'change']);
    realtime.closeStreams();
    expect(completed).toBe(true);
    await realtime.onModuleDestroy();
  });

  it('끄는 중인 서버는 새 실시간 연결을 503으로 거절(앱이 다른 서버로 다시 붙음)', async () => {
    const realtime = setup();
    realtime.closeStreams();
    expect(() => controller(realtime).stream(fan)).toThrow('Service Unavailable');
    await realtime.onModuleDestroy();
  });
});
