import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ActorLinksService, hashLinkToken } from './actor-links.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { MediaService } from '../storage/media.service.js';
import { ActorKind, Role } from '../generated/prisma/enums.js';

const HOUR = 3_600_000;

function make(options: { link?: Record<string, unknown> | null; actor?: Record<string, unknown>; user?: Record<string, unknown>; otherActor?: { id: string } | null } = {}) {
  const link = options.link === undefined ? { id: 'l1', actorId: 'a1', expiresAt: new Date(Date.now() + HOUR), usedAt: null, usedByUserId: null, revokedAt: null } : options.link;
  const tx = {
    actorLinkToken: { findUnique: vi.fn().mockResolvedValue(link), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
    actor: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'a1', kind: ActorKind.SOLO, selfUserId: null, ...options.actor }),
      findUnique: vi.fn().mockResolvedValue(options.otherActor ?? null),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
    },
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ role: Role.USER, deletedAt: null, _count: { subscriptions: 0 }, ...options.user }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[]))) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new ActorLinksService(prisma as unknown as PrismaService, audit as unknown as AuditService, { resolveImageUrl: vi.fn() } as unknown as MediaService);
  return { service, tx, audit };
}

describe('아티스트 계정 연결 링크', () => {
  it('연결: 해시로 찾고, 역할을 아티스트로 + 본인 계정 지정 + 링크 사용 처리 + 기록', async () => {
    const { service, tx, audit } = make();
    expect(await service.claim('u1', 'tok')).toEqual({ actorId: 'a1' });
    expect(tx.actorLinkToken.findUnique.mock.calls[0][0]).toMatchObject({ where: { tokenHash: hashLinkToken('tok') } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: Role.ACTOR, agencyId: null } });
    expect(tx.actor.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { selfUserId: 'u1' } });
    expect(tx.actorLinkToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'l1', usedAt: null }, data: { usedByUserId: 'u1' } });
    expect(audit.record).toHaveBeenCalledWith('u1', 'ACTOR_LINK_CLAIM', 'ACTOR', 'a1');
  });

  it('같은 계정이 다시 누르면 그대로 성공, 다른 계정이면 이미 사용', async () => {
    const used = { id: 'l1', actorId: 'a1', expiresAt: new Date(Date.now() + HOUR), usedAt: new Date(), usedByUserId: 'u1', revokedAt: null };
    const again = make({ link: used });
    expect(await again.service.claim('u1', 'tok')).toEqual({ actorId: 'a1' });
    expect(again.tx.user.update).not.toHaveBeenCalled();
    await expect(make({ link: used }).service.claim('u2', 'tok')).rejects.toMatchObject({ response: { code: 'LINK_USED' } });
  });

  it('막는 경우: 없는·취소된·만료된 링크, 구독 중인 팬, 운영자·소속사 직원, 다른 아티스트에 연결된 계정, 이미 계정이 있는 아티스트', async () => {
    await expect(make({ link: null }).service.claim('u1', 'x')).rejects.toMatchObject({ response: { code: 'LINK_INVALID' } });
    await expect(
      make({ link: { id: 'l1', actorId: 'a1', expiresAt: new Date(Date.now() + HOUR), usedAt: null, revokedAt: new Date() } }).service.claim('u1', 'x'),
    ).rejects.toMatchObject({ response: { code: 'LINK_INVALID' } });
    await expect(
      make({ link: { id: 'l1', actorId: 'a1', expiresAt: new Date(Date.now() - 1), usedAt: null, revokedAt: null } }).service.claim('u1', 'x'),
    ).rejects.toMatchObject({ response: { code: 'LINK_EXPIRED' } });
    await expect(make({ user: { _count: { subscriptions: 1 } } }).service.claim('u1', 'x')).rejects.toBeInstanceOf(BadRequestException);
    await expect(make({ user: { role: Role.AGENCY_STAFF } }).service.claim('u1', 'x')).rejects.toMatchObject({ response: { code: 'LINK_ROLE_NOT_ALLOWED' } });
    await expect(make({ user: { role: Role.ACTOR }, otherActor: { id: 'a9' } }).service.claim('u1', 'x')).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ actor: { selfUserId: 'someone' } }).service.claim('u1', 'x')).rejects.toMatchObject({ response: { code: 'ACTOR_ALREADY_HAS_ACCOUNT' } });
  });

  it('만들기: CP방·이미 연결된 아티스트는 건너뛰고, 예전 링크는 취소, 원문 토큰은 응답에만', async () => {
    const { service, tx } = make();
    tx.actor.findMany.mockResolvedValue([
      { id: 'a1', legalName: 'Bright', kind: ActorKind.SOLO, selfUserId: null },
      { id: 'c1', legalName: 'Bright & Win', kind: ActorKind.COUPLE, selfUserId: null },
      { id: 'a2', legalName: 'Win', kind: ActorKind.SOLO, selfUserId: 'u9' },
    ]);
    const result = await service.issue('admin', ['a1', 'c1', 'a2']);
    expect(result.links).toHaveLength(1);
    expect(result.skipped.map((item) => item.reason)).toEqual(['COUPLE', 'LINKED']);
    const token = result.links[0].token;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(tx.actorLinkToken.create.mock.calls[0][0].data.tokenHash).toBe(hashLinkToken(token));
    expect(tx.actorLinkToken.updateMany.mock.calls[0][0]).toMatchObject({ where: { actorId: 'a1', usedAt: null, revokedAt: null } });
  });
});
