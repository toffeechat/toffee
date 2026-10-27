import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { MAX_STREAMS_PER_USER, RealtimeController, accountUsable, canReceive } from './realtime.controller.js';
import type { RealtimeService } from './realtime.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const fan = { admin: false, subscribed: new Set(['a1']), staff: new Set<string>() };
const star = { admin: false, subscribed: new Set<string>(), staff: new Set(['a1']) };

describe('실시간 신호 받을 대상', () => {
  it('팬은 구독 중인 아티스트의 아티스트 메시지·삭제 신호만', () => {
    expect(canReceive(fan, { kind: 'artist-message', actorId: 'a1' })).toBe(true);
    expect(canReceive(fan, { kind: 'message-removed', actorId: 'a1' })).toBe(true);
    expect(canReceive(fan, { kind: 'artist-message', actorId: 'a2' })).toBe(false);
  });

  it('다른 팬의 답장 신호는 팬에게 안 감', () => {
    expect(canReceive(fan, { kind: 'fan-reply', actorId: 'a1', messageId: 'm1' })).toBe(false);
  });

  it('아티스트·소속사는 자기 아티스트의 모든 신호, 운영자는 전부', () => {
    expect(canReceive(star, { kind: 'fan-reply', actorId: 'a1', messageId: 'm1' })).toBe(true);
    expect(canReceive(star, { kind: 'fan-reply', actorId: 'a2', messageId: 'm1' })).toBe(false);
    expect(canReceive({ admin: true, subscribed: new Set(), staff: new Set() }, { kind: 'fan-reply', actorId: 'a9' })).toBe(true);
  });
});

describe('실시간 연결 중 계정 상태(2026-10-27)', () => {
  const base = { status: 'ACTIVE' as const, deletedAt: null, suspendedUntil: null };
  it('영구 정지·탈퇴·정지 기간 중이면 연결을 닫음, 정지 기간이 지났으면 유지', () => {
    const now = new Date('2026-10-27T00:00:00Z');
    expect(accountUsable(base, now)).toBe(true);
    expect(accountUsable({ ...base, status: 'BANNED' }, now)).toBe(false);
    expect(accountUsable({ ...base, deletedAt: now }, now)).toBe(false);
    expect(accountUsable({ ...base, status: 'SUSPENDED', suspendedUntil: new Date('2026-10-28') }, now)).toBe(false);
    expect(accountUsable({ ...base, status: 'SUSPENDED', suspendedUntil: new Date('2026-10-26') }, now)).toBe(true);
  });
});

describe('계정당 동시 연결 수(2026-10-27)', () => {
  it(`${MAX_STREAMS_PER_USER}개를 넘으면 가장 오래된 연결을 닫음`, () => {
    const realtime = { acceptingStreams: true, events$: new Subject(), streamsClosed$: new Subject() } as unknown as RealtimeService;
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const controller = new RealtimeController(realtime, prisma);
    const closed: number[] = [];
    const subs = Array.from({ length: MAX_STREAMS_PER_USER + 1 }, (_, index) =>
      controller.stream({ id: 'u1', role: 'USER' } as AuthenticatedUser).subscribe({ complete: () => closed.push(index) }),
    );
    expect(closed).toEqual([0]);
    subs.forEach((sub) => sub.unsubscribe());
  });
});
