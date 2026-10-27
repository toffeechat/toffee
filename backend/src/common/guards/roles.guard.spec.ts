import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ADMIN_MFA_TTL_MS, RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { ADMIN_OWNER_KEY, SKIP_MFA_KEY } from '../decorators/admin-access.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

const run = (user: AuthenticatedUser | undefined, meta: Record<string, unknown> = {}) => {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return () => new RolesGuard(reflector).canActivate(context);
};

const admin = (extra: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({ id: 'a1', role: 'ADMIN', mfaEnabled: true, ...extra });

describe('역할·운영자 2단계 인증 가드(2026-10-27)', () => {
  it('@Roles 없는 일반 API도 2단계 인증 확인 전 운영자 토큰이면 거절', () => {
    expect(run(admin())).toThrow(UnauthorizedException);
    expect(run(admin({ mfaAt: Date.now() - ADMIN_MFA_TTL_MS - 1000 }))).toThrow(UnauthorizedException);
    expect(run(admin({ mfaAt: Date.now() }))()).toBe(true);
  });

  it('@SkipAdminMfa 라우트·2단계 인증을 안 켠 운영자·운영자가 아닌 계정·공개 라우트(user 없음)는 통과', () => {
    expect(run(admin(), { [SKIP_MFA_KEY]: true })()).toBe(true);
    expect(run(admin({ mfaEnabled: false }))()).toBe(true);
    expect(run({ id: 'u1', role: 'USER' })()).toBe(true);
    expect(run(undefined)()).toBe(true);
  });

  it('@Roles가 있으면 역할이 맞아야, 고객 응대 운영자는 OWNER 전용 API 불가', () => {
    expect(run({ id: 'u1', role: 'USER' }, { [ROLES_KEY]: ['ADMIN'] })).toThrow(ForbiddenException);
    expect(run(undefined, { [ROLES_KEY]: ['ADMIN'] })).toThrow(ForbiddenException);
    expect(run(admin({ mfaAt: Date.now(), adminLevel: 'SUPPORT' }), { [ROLES_KEY]: ['ADMIN'], [ADMIN_OWNER_KEY]: true })).toThrow(ForbiddenException);
    expect(run(admin({ mfaAt: Date.now(), adminLevel: 'OWNER' }), { [ROLES_KEY]: ['ADMIN'], [ADMIN_OWNER_KEY]: true })()).toBe(true);
  });
});
