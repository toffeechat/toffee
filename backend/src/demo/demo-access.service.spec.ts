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

function make(
  options: { env?: Record<string, string>; code?: Record<string, unknown> | null; roleSeen?: Record<string, unknown> | null; pastVisits?: Record<string, unknown>[] } = {},
) {
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
    demoAccessEvent: {
      create: vi.fn().mockResolvedValue({ id: 'e-now' }),
      deleteMany: vi.fn().mockReturnValue('events'),
      // 지난 접속 줄(첫 접속을 사람 접속만으로 다시 셀 때) — 기본은 없음
      findMany: vi.fn().mockResolvedValue(options.pastVisits ?? []),
    },
    // 화면별 요약 — 기본은 이 화면으로 처음 들어옴(줄 없음)
    demoAccessRoleSeen: {
      findUnique: vi.fn().mockResolvedValue(options.roleSeen ?? null),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockReturnValue('roles'),
    },
    $transaction: vi.fn().mockResolvedValue([]),
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
    expect(email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 첫 접속 (소속사 화면)');
    expect(email.send.mock.calls[0][2]).toContain('소속사');
  });

  it('30분 안에 같은 화면으로 다시 오면 메일 없이 기록만', async () => {
    const { service, prisma, email } = make({ roleSeen: { lastSeenAt: new Date(Date.now() - 60_000), visitCount: 1 } });
    // 코드 전체도 최근에 활동이 있었음
    prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.record('c1', 'c1:fan', 'fan', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ role: 'fan', kind: 'LOGIN', newVisit: false });
    expect(email.send).not.toHaveBeenCalled();
    // 화면 줄은 마지막 활동만 갱신(횟수 그대로)
    expect(prisma.demoAccessRoleSeen.updateMany.mock.calls[0][0]).toMatchObject({ where: { codeId: 'c1', role: 'fan' } });
    expect(prisma.demoAccessRoleSeen.updateMany.mock.calls[0][0].data).not.toHaveProperty('visitCount');
    // 코드 전체 조건: 마지막 활동이 30분보다 오래됐을 때만 새 접속
    const where = prisma.demoAccessCode.updateMany.mock.calls[0][0].where;
    const cutoff: Date = where.OR[1].lastSeenAt.lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(NEW_VISIT_GAP_MS - 1000);
  });

  it('30분 안이라도 다른 화면을 처음 열면 그 화면 첫 접속 메일', async () => {
    const { service, prisma, email } = make();
    prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.record('c1', 'c1:fan', 'fan', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessRoleSeen.create.mock.calls[0][0].data).toMatchObject({ codeId: 'c1', role: 'fan' });
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ role: 'fan', newVisit: true });
    expect(email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 팬 화면 첫 접속');
  });

  it('다시 들어오면 몇 번째인지 메일, 받는 주소가 없으면 안 보냄', async () => {
    const again = make({
      code: { id: 'c1', code: 'gmm-7k3p', agencyName: 'GMM', visitCount: 5 },
      roleSeen: { lastSeenAt: new Date(Date.now() - 2 * NEW_VISIT_GAP_MS), visitCount: 2 },
    });
    again.prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await again.service.record('c1', 'c1:artist', 'artist', 'VISIT', CLIENT, new Date());
    expect(again.email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 아티스트 화면 접속 (3번째)');
    expect(again.email.send.mock.calls[0][2]).toContain('코드 전체 5번째');
    // 화면 줄 조건부 갱신 — 30분보다 오래됐을 때만 +1
    expect(again.prisma.demoAccessRoleSeen.updateMany.mock.calls[0][0].data).toMatchObject({ visitCount: { increment: 1 } });

    const noMail = make({ env: { DEMO_ALERT_EMAIL: '' } });
    await noMail.service.record('c1', 'c1:agency', 'agency', 'LOGIN', CLIENT, new Date());
    expect(noMail.email.send).not.toHaveBeenCalled();
  });

  it('공용 코드는 기록만(codeId 없음), 메일은 안 보냄', async () => {
    const { service, prisma, email } = make();
    await service.record(COMMON_DEMO_CODE, 'common:fan', 'fan', 'LOGIN', CLIENT, new Date());
    expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ codeId: null, newVisit: true });
    expect(prisma.demoAccessCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.demoAccessRoleSeen.findUnique).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(await service.recentlyActive()).toBe(true);
  });

  it('기록 초기화: 코드는 그대로, 기록·화면별 요약·첫 접속·횟수만 지우고 다음 접속은 다시 첫 접속', async () => {
    const { service, prisma, email } = make();
    await service.resetStats('c1');
    expect(prisma.demoAccessEvent.deleteMany).toHaveBeenCalledWith({ where: { codeId: 'c1' } });
    expect(prisma.demoAccessRoleSeen.deleteMany).toHaveBeenCalledWith({ where: { codeId: 'c1' } });
    expect(prisma.demoAccessCode.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { firstSeenAt: null, lastSeenAt: null, visitCount: 0 } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    // 코드·만료일은 건드리지 않음
    expect(prisma.demoAccessCode.update.mock.calls[0][0].data).not.toHaveProperty('code');
    // 5분 안에 다시 와도 기다리지 않고 바로 처리
    service.touch('c1', Role.AGENCY_STAFF, 'VISIT', CLIENT);
    await vi.waitFor(() => expect(email.send).toHaveBeenCalled());

    const missing = make({ code: null });
    await expect(missing.service.resetStats('nope')).rejects.toThrow();
  });

  it('등록: 비우면 코드를 만들어 주고, 형식이 틀리거나 공용·운영자 코드와 같으면 거절', async () => {
    const { service, prisma } = make({ code: null, env: { DEV_LOGIN_CODE: 'Shared-Code', DEV_LOGIN_ADMIN_CODE: 'admin-secret' } });
    const created = await service.create({ agencyName: ' GMM ', expiresAt: '2026-12-31T00:00:00.000Z' });
    expect(created).toMatchObject({ agencyName: 'GMM' });
    expect(prisma.demoAccessCode.create.mock.calls[0][0].data.code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    await expect(service.create({ agencyName: 'A', code: 'ab', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ agencyName: 'A', code: 'has space', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    // 직접 정하는 코드도 8자 이상(2026-10-29)
    await expect(service.create({ agencyName: 'A', code: 'abcdefg', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ agencyName: 'A', code: 'SHARED-CODE', expiresAt: '2026-12-31' })).rejects.toBeInstanceOf(ConflictException);
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

  it('링크 자동 검사(Meta 서버·검사 봇·자동 조종·세계 표준시)는 기록만 남기고 첫 접속·횟수·메일은 그대로(2026-10-29)', async () => {
    const bots: ClientInfo[] = [
      { ...CLIENT, ip: '69.171.249.1' },
      { ...CLIENT, ip: '::ffff:66.249.66.1' },
      { ...CLIENT, userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      { ...CLIENT, automationHint: true },
      { ...CLIENT, timeZone: 'UTC' },
    ];
    for (const [i, bot] of bots.entries()) {
      const { service, prisma, email } = make();
      await service.record('c1', `c1:agency:${i}`, 'agency', 'LOGIN', bot, new Date());
      expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).toMatchObject({ codeId: 'c1', newVisit: false, automated: expect.any(String) });
      expect(prisma.demoAccessEvent.create.mock.calls[0][0].data).not.toHaveProperty('automationHint');
      expect(prisma.demoAccessCode.updateMany).not.toHaveBeenCalled();
      expect(prisma.demoAccessRoleSeen.findUnique).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    }
    // 태국 시간대·일반 브라우저·일반 IP는 사람
    const { service, email } = make();
    await service.record('c1', 'c1:agency', 'agency', 'LOGIN', { ...CLIENT, timeZone: 'Asia/Bangkok', userAgent: 'Mozilla/5.0 (iPhone) Instagram 300.0' }, new Date());
    expect(email.send).toHaveBeenCalledOnce();
  });

  it('거르기 전에 자동 검사가 먼저 연 코드도 소속사가 처음 열면 "첫 접속" 메일', async () => {
    const { service, prisma, email } = make({
      code: { id: 'c1', code: 'gmm-7k3p', agencyName: 'GMM', visitCount: 2 },
      roleSeen: { lastSeenAt: new Date(Date.now() - 2 * NEW_VISIT_GAP_MS), visitCount: 1 },
      // 예전 기록: 인스타 DM 미리보기(Meta IP) — 그때는 자동 검사 표시가 없었음
      pastVisits: [{ role: 'agency', automated: null, ip: '31.13.115.2', userAgent: null, timeZone: null }],
    });
    prisma.demoAccessCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await service.record('c1', 'c1:agency', 'agency', 'LOGIN', CLIENT, new Date());
    expect(email.send.mock.calls[0][1]).toBe('[토피 데모] GMM 첫 접속 (소속사 화면)');
  });

  it('접속 기록·목록: 예전 기록도 IP로 "자동 검사" 표시, 화면별 횟수에서 빼고 따로 셈', async () => {
    const { service, prisma } = make();
    const at = new Date('2026-10-28T10:00:00Z');
    const rows = [
      { id: 'e1', codeId: 'c1', role: 'agency', kind: 'LOGIN', newVisit: true, automated: null, ip: '157.240.1.1', userAgent: null, timeZone: null, createdAt: at },
      { id: 'e2', codeId: 'c1', role: 'fan', kind: 'LOGIN', newVisit: true, automated: null, ip: '1.2.3.4', userAgent: null, timeZone: 'Asia/Bangkok', createdAt: new Date(at.getTime() + DAY) },
    ];
    prisma.demoAccessEvent.findMany.mockResolvedValue(rows);
    const events = await service.events('c1');
    expect(events.map((event) => event.automated)).toEqual(['Meta 서버', null]);
    expect(events[0]).not.toHaveProperty('userAgent');

    Object.assign(prisma.demoAccessCode, { findMany: vi.fn().mockResolvedValue([{ id: 'c1', agencyName: 'GMM', code: 'gmm-7k3p', expiresAt: new Date(Date.now() + DAY), revokedAt: null, visitCount: 2 }]) });
    Object.assign(prisma.demoAccessEvent, { aggregate: vi.fn().mockResolvedValue({ _min: {}, _max: {} }), count: vi.fn().mockResolvedValue(0) });
    const { codes } = await service.list();
    expect(codes[0]).toMatchObject({ roleCounts: { fan: 1 }, automatedCount: 1, firstHumanSeenAt: rows[1].createdAt });
  });
});
