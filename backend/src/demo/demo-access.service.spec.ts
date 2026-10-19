import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { COMMON_DEMO_CODE, DemoAccessService, demoRoleOf, generateDemoCode, NEW_VISIT_GAP_MS } from './demo-access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from '../notifications/email.service.js';
import type { ClientInfo } from '../access-log/client-info.js';
import { Role } from '../generated/prisma/enums.js';

const CLIENT: ClientInfo = { platform: 'web', deviceModel: 'Chrome · macOS', osVersion: null, appVersion: null, userAgent: null, ip: '1.2.3.4' };
const DAY = 24 * 60 * 60 * 1000;

function make(options: { env?: Record<string, string>; code?: Record<string, unknown> | null } = {}) {
  const env = { DEMO_ALERT_EMAIL: 'ops@example.com', ...options.env };
  const code = options.code === undefined ? { id: 'c1', code: 'gmm-7k3p', agencyName: 'GMM', expiresAt: new Date(Date.now() + DAY), revokedAt: null, visitCount: 1 } : options.code;
  const prisma = {
    demoAccessCode: {
      findUnique: vi.fn().mockResolvedValue(code),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
    demoAccessEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const email = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new DemoAccessService(
    prisma as unknown as PrismaService,
    { get: (key: string) => env[key as keyof typeof env] } as unknown as ConfigService,
    email as unknown as EmailService,
  );
  return { service, prisma, email };
}

describe('소속사별 데모 입장 코드', () => {
  it('로그인: 등록된 코드는 대소문자 구분 없이 찾고, 만료·중지면 거절', async () => {
    const { service, prisma } = make();
    expect(await service.findLoginCode('  GMM-7K3P ')).toBe('c1');
    expect(prisma.demoAccessCode.findUnique).toHaveBeenCalledWith({ where: { code: 'gmm-7k3p' } });

    const expired = make({ code: { id: 'c1', expiresAt: new Date(Date.now() - 1000), revokedAt: null } });
    await expect(expired.service.findLoginCode('gmm-7k3p')).rejects.toBeInstanceOf(UnauthorizedException);
    const revoked = make({ code: { id: 'c1', expiresAt: new Date(Date.now() + DAY), revokedAt: new Date() } });
    await expect(revoked.service.findLoginCode('gmm-7k3p')).rejects.toBeInstanceOf(UnauthorizedException);

    // 등록 안 된 코드·빈 코드는 null(공용 코드 확인은 AuthService)
    expect(await make({ code: null }).service.findLoginCode('other')).toBeNull();
    expect(await service.findLoginCode(undefined)).toBeNull();
  });

  it('요청마다: 만료·중지된 코드면 로그인 중이어도 401, 확인 결과는 잠깐 재사용(중지하면 바로 지움)', async () => {
    const { service, prisma } = make();
    await service.assertActive('c1');
    await service.assertActive('c1');
    expect(prisma.demoAccessCode.findUnique).toHaveBeenCalledOnce();

    prisma.demoAccessCode.findUnique.mockResolvedValue({ id: 'c1', expiresAt: new Date(Date.now() + DAY), revokedAt: null });
    await service.update('c1', { revoked: true });
    prisma.demoAccessCode.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + DAY), revokedAt: new Date() });
    await expect(service.assertActive('c1')).rejects.toBeInstanceOf(UnauthorizedException);

    // 공용 코드는 DB를 안 봄
    await expect(service.assertActive(COMMON_DEMO_CODE)).resolves.toBeUndefined();
  });

  it('처음 들어오면 기록 + "첫 접속" 메일', async () => {
    const { service, prisma, email } = make();
    await service.record('c1', 'c1:agency', 'agency', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ codeId: 'c1', role: 'agency', kind: 'LOGIN', newVisit: true, ip: '1.2.3.4' });
    expect(email.send).toHaveBeenCalledOnce();
    expect(email.send.mock.calls[0][0]).toBe('ops@example.com');
    expect(email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 첫 접속');
    expect(email.send.mock.calls[0][2]).toContain('소속사');
  });

  it('30분 안에 다시 오면(역할 바꾸기 포함) 메일 없이 기록만', async () => {
    const { service, prisma, email } = make();
    // 30분 조건부 갱신이 안 걸림 = 최근에 활동이 있었음
    prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.record('c1', 'c1:fan', 'fan', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ role: 'fan', kind: 'LOGIN', newVisit: false });
    expect(email.send).not.toHaveBeenCalled();
    // 조건: 마지막 활동이 30분보다 오래됐을 때만 새 접속
    const where = prisma.demoAccessCode.updateMany.mock.calls[0][0].where;
    const cutoff: Date = where.OR[1].lastSeenAt.lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(NEW_VISIT_GAP_MS - 1000);
  });

  it('다시 들어오면 몇 번째인지 메일, 받는 주소가 없으면 안 보냄', async () => {
    const again = make({ code: { id: 'c1', code: 'gmm-7k3p', agencyName: 'GMM', visitCount: 3 } });
    again.prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await again.service.record('c1', 'c1:artist', 'artist', 'VISIT', CLIENT, new Date());
    expect(again.email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 접속 (3번째)');

    const noMail = make({ env: { DEMO_ALERT_EMAIL: '' } });
    await noMail.service.record('c1', 'c1:agency', 'agency', 'LOGIN', CLIENT, new Date());
    expect(noMail.email.send).not.toHaveBeenCalled();
  });

  it('공용 코드는 기록만(codeId 없음), 메일은 안 보냄', async () => {
    const { service, prisma, email } = make();
    await service.record(COMMON_DEMO_CODE, 'common:fan', 'fan', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ codeId: null, newVisit: true });
    expect(prisma.demoAccessCode.updateMany).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(await service.recentlyActive()).toBe(true);
  });

  it('등록: 비우면 코드를 만들어 주고, 형식이 틀리거나 공용·운영자 코드와 같으면 거절', async () => {
    const { service, prisma } = make({ code: null, env: { DEV_LOGIN_CODE: 'Shared', DEV_LOGIN_ADMIN_CODE: 'admin-secret' } });
    const created = await service.create({ agencyName: ' GMM ', expiresAt: '2026-12-31T00:00:00.000Z' });
    expect(created).toMatchObject({ agencyName: 'GMM' });
    expect(prisma.demoAccessCode.create.mock.calls[0][0].data.code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    await expect(service.create({ agencyName: 'A', code: 'ab', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ agencyName: 'A', code: 'has space', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ agencyName: 'A', code: 'SHARED', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create({ agencyName: 'A', code: 'admin-secret', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('이미 있는 코드는 거절', async () => {
    const { service } = make();
    await expect(service.create({ agencyName: 'A', code: 'gmm-7k3p', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('역할 이름·자동 코드 모양', () => {
    expect(demoRoleOf(Role.AGENCY_STAFF)).toBe('agency');
    expect(demoRoleOf(Role.ACTOR)).toBe('artist');
    expect(demoRoleOf(Role.USER)).toBe('fan');
    expect(generateDemoCode()).not.toMatch(/[01ilo]/);
  });
});
