import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy.js';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 1000);

function setup(user: Record<string, unknown> | null) {
  const findUnique = vi.fn().mockResolvedValue(user);
  const strategy = new JwtStrategy(
    { getOrThrow: () => 'secret' } as never,
    { user: { findUnique } } as never,
    { touchVisit: vi.fn() } as never,
    { assertActive: vi.fn(), touch: vi.fn() } as never,
  );
  const req = { headers: {} } as Request;
  return { strategy, findUnique, req };
}

const fan = (extra: Record<string, unknown> = {}) => ({
  id: 'u1',
  role: 'USER',
  status: 'ACTIVE',
  deletedAt: null,
  suspendedUntil: null,
  lastActiveAt: null,
  tokenVersion: 0,
  authSessions: [],
  ...extra,
});

describe('로그인 세션 확인(2026-10-27)', () => {
  it('세션이 살아 있으면 통과하고 sid·tv를 req.user에 담음 — 세션은 같은 조회로', async () => {
    const { strategy, findUnique, req } = setup(fan({ tokenVersion: 2, authSessions: [{ revokedAt: null, expiresAt: future }] }));
    await expect(strategy.validate(req, { sub: 'u1', sid: 's1', tv: 2 })).resolves.toMatchObject({ id: 'u1', sessionId: 's1', tokenVersion: 2 });
    expect(findUnique.mock.calls[0][0].include.authSessions.where).toEqual({ id: 's1' });
  });

  it('tokenVersion이 다르면(모든 기기 로그아웃·제재) 401', async () => {
    const { strategy, req } = setup(fan({ tokenVersion: 3, authSessions: [{ revokedAt: null, expiresAt: future }] }));
    await expect(strategy.validate(req, { sub: 'u1', sid: 's1', tv: 2 })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('끊긴·만료된·없는 세션이면 401', async () => {
    for (const authSessions of [[{ revokedAt: new Date(), expiresAt: future }], [{ revokedAt: null, expiresAt: past }], []]) {
      const { strategy, req } = setup(fan({ authSessions }));
      await expect(strategy.validate(req, { sub: 'u1', sid: 's1', tv: 0 })).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('sid 없는 옛 토큰은 tv만 맞으면 통과(앱이 갱신하며 세션 있는 토큰으로 옮김)', async () => {
    const { strategy, req } = setup(fan());
    await expect(strategy.validate(req, { sub: 'u1' })).resolves.toMatchObject({ id: 'u1', tokenVersion: 0 });
    const bumped = setup(fan({ tokenVersion: 1 }));
    await expect(bumped.strategy.validate(bumped.req, { sub: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('영구 정지면 세션이 끊겼어도 정지 안내가 먼저', async () => {
    const { strategy, req } = setup(fan({ status: 'BANNED', tokenVersion: 5 }));
    await expect(strategy.validate(req, { sub: 'u1', sid: 's1', tv: 0 })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ACCOUNT_BANNED' }) });
  });
});
