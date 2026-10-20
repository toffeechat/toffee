import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AdminSecurityService } from './admin-security.service.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { totpCode } from '../common/utils/totp.js';

const SECRET = 'JBSWY3DPEHPK3PXP';

function setup(user: Record<string, unknown>, owners = 1) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findUniqueOrThrow: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(owners),
      update: vi.fn().mockResolvedValue(user),
    },
  };
  const auth = { issueAccessToken: vi.fn().mockResolvedValue({ accessToken: 't' }) };
  const service = new AdminSecurityService(prisma as never, { record: vi.fn() } as never, auth as never);
  return { prisma, auth, service };
}

describe('운영자 2단계 인증·권한 단계(2026-10-20)', () => {
  it('마지막 전체 권한 운영자는 고객 응대로 못 내림', async () => {
    const { service, prisma } = setup({ role: 'ADMIN', adminLevel: null }, 1);
    await expect(service.setLevel('me', 'a1', 'SUPPORT')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('전체 권한이 2명 이상이면 내릴 수 있음', async () => {
    const { service, prisma } = setup({ role: 'ADMIN', adminLevel: 'OWNER' }, 2);
    await service.setLevel('me', 'a1', 'SUPPORT');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { adminLevel: 'SUPPORT' } });
  });

  it('코드가 맞아야 mfaAt이 담긴 토큰', async () => {
    const { service, auth } = setup({ id: 'a1', role: 'ADMIN', totpSecret: SECRET, totpEnabledAt: new Date() });
    await expect(service.verify('a1', '000000' === totpCode(SECRET) ? '111111' : '000000')).rejects.toBeInstanceOf(BadRequestException);
    await service.verify('a1', totpCode(SECRET));
    expect(auth.issueAccessToken.mock.calls[0][2]).toEqual(expect.any(Number));
  });

  it('RolesGuard — 켠 운영자는 확인 없는 토큰이면 401, 고객 응대는 OWNER 전용 API 403', () => {
    const reflector = { getAllAndOverride: vi.fn((key: string) => (key === 'roles' ? ['ADMIN'] : key === 'adminOwnerOnly')) };
    const guard = new RolesGuard(reflector as never);
    const ctx = (user: object) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
    expect(() => guard.canActivate(ctx({ id: 'a', role: 'ADMIN', mfaEnabled: true }))).toThrow();
    expect(() => guard.canActivate(ctx({ id: 'a', role: 'ADMIN', adminLevel: 'SUPPORT' }))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx({ id: 'a', role: 'ADMIN', adminLevel: 'OWNER', mfaEnabled: true, mfaAt: Date.now() }))).toBe(true);
  });
});
