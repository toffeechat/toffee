import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service.js';
import { translateError } from '../common/i18n/error-messages.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

describe('운영자 제재 — 사유·작업 기록', () => {
  it('정지하면 사유를 저장하고 작업 기록을 남김', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'u1' });
    const record = vi.fn().mockResolvedValue(undefined);
    const findUnique = vi.fn().mockResolvedValue({ role: 'USER', adminLevel: null, deletedAt: null });
    const service = new AdminUsersService({ user: { update, findUnique } } as unknown as PrismaService, { record } as unknown as AuditService);
    const until = new Date('2026-10-01T00:00:00Z');
    await service.suspend({ id: 'admin-1', role: 'ADMIN', adminLevel: 'SUPPORT' }, 'u1', until, { category: 'ABUSE', note: ' 반복 욕설 ' });
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'SUSPENDED', sanctionCategory: 'ABUSE', sanctionNote: '반복 욕설' });
    expect(record).toHaveBeenCalledWith('admin-1', 'USER_SUSPEND', 'USER', 'u1', expect.objectContaining({ category: 'ABUSE' }));
    // 로그인도 모두 끊음(2026-10-27)
    expect(update.mock.calls[0][0].data).toMatchObject({ tokenVersion: { increment: 1 }, authSessions: { updateMany: { data: { revokedAt: expect.any(Date) } } } });
  });

  it('모든 기기에서 로그아웃시키기 — tokenVersion을 올리고 작업 기록(2026-10-27)', async () => {
    const update = vi.fn().mockResolvedValue({ tokenVersion: 1 });
    const record = vi.fn().mockResolvedValue(undefined);
    const findUnique = vi.fn().mockResolvedValue({ id: 'u1', role: 'USER', adminLevel: null, deletedAt: null });
    const service = new AdminUsersService({ user: { update, findUnique } } as unknown as PrismaService, { record } as unknown as AuditService);
    await service.signOutEverywhere({ id: 'admin-1', role: 'ADMIN', adminLevel: 'SUPPORT' }, 'u1');
    expect(update.mock.calls[0][0].data).toMatchObject({ tokenVersion: { increment: 1 } });
    expect(record).toHaveBeenCalledWith('admin-1', 'USER_SIGN_OUT', 'USER', 'u1');
    await expect(service.signOutEverywhere({ id: 'u1', role: 'ADMIN' }, 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('당사자 안내 문구에 사유 분류가 받는 사람 언어로 붙음(메모는 안 나감)', () => {
    expect(translateError('ACCOUNT_BANNED', 'th', { reason: 'SPAM' })).toBe('บัญชีนี้ถูกจำกัดการใช้งาน เหตุผล: สแปมหรือโฆษณา');
    expect(translateError('ACCOUNT_BANNED', 'ko')).toBe('이용이 제한된 계정이에요.');
  });
});

describe('팬 한 명 기준 보기(2026-10-22)', () => {
  it('답장·받은 신고·한 신고·차단·작업 기록을 그 팬 기준으로 모아 줌', async () => {
    const messageFindMany = vi.fn().mockResolvedValue([{ id: 'm1', body: '안녕', deletedAt: null, _count: { reports: 2 } }]);
    const reportFindMany = vi.fn().mockResolvedValueOnce([{ id: 'r-in' }]).mockResolvedValueOnce([{ id: 'r-out' }]);
    const blockFindMany = vi.fn().mockResolvedValue([{ id: 'b1' }]);
    const actionFindMany = vi.fn().mockResolvedValue([{ id: 'a1', action: 'USER_SUSPEND' }]);
    const prisma = {
      message: { findMany: messageFindMany },
      report: { findMany: reportFindMany },
      actorFanBlock: { findMany: blockFindMany },
      adminAction: { findMany: actionFindMany },
    } as unknown as PrismaService;
    const service = new AdminUsersService(prisma, {} as AuditService);
    const result = await service.activity('u1');
    expect(messageFindMany.mock.calls[0][0].where).toEqual({ fanUserId: 'u1', senderType: 'FAN' });
    expect(reportFindMany.mock.calls[0][0].where).toEqual({ message: { fanUserId: 'u1' } });
    expect(reportFindMany.mock.calls[1][0].where).toEqual({ reportedById: 'u1' });
    expect(blockFindMany.mock.calls[0][0].where).toEqual({ fanUserId: 'u1' });
    expect(actionFindMany.mock.calls[0][0].where).toEqual({ targetType: 'USER', targetId: 'u1' });
    expect(result.replies[0]).toEqual({ id: 'm1', body: '안녕', deletedAt: null, reportCount: 2 });
    expect(result.reportsReceived).toEqual([{ id: 'r-in' }]);
    expect(result.reportsFiled).toEqual([{ id: 'r-out' }]);
  });
});

describe('회원 목록 기간 필터(2026-10-25)', () => {
  it('가입일 기간이면 그 기간 가입 + 탈퇴 제외(역할별 인원도 같은 조건)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const groupBy = vi.fn().mockResolvedValue([{ role: 'USER', _count: { _all: 54 } }]);
    const service = new AdminUsersService({ user: { findMany, groupBy } } as unknown as PrismaService, {} as AuditService);
    const start = new Date('2026-10-24T17:00:00Z');
    const end = new Date('2026-10-25T17:00:00Z');
    const result = await service.findAll(undefined, 'USER', undefined, 1, { field: 'joined', start, end });
    expect(findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, createdAt: { gte: start, lt: end }, role: 'USER' });
    expect(groupBy.mock.calls[0][0].where).toEqual({ deletedAt: null, createdAt: { gte: start, lt: end } });
    expect(result.total).toBe(54);
  });

  it('최근 접속 기간이면 마지막 접속으로 거름', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const groupBy = vi.fn().mockResolvedValue([]);
    const service = new AdminUsersService({ user: { findMany, groupBy } } as unknown as PrismaService, {} as AuditService);
    const start = new Date('2026-10-24T17:00:00Z');
    const end = new Date('2026-10-25T17:00:00Z');
    await service.findAll(undefined, undefined, 'recent', 1, { field: 'active', start, end });
    expect(findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, lastActiveAt: { gte: start, lt: end } });
  });
});

describe('운영자 계정 보호(2026-10-27)', () => {
  const owner = { id: 'owner-1', role: 'ADMIN' as const, adminLevel: 'OWNER' as const };
  const support = { id: 'support-1', role: 'ADMIN' as const, adminLevel: 'SUPPORT' as const };
  const setup = (target: { role: string; adminLevel: string | null } | null, owners = 2) => {
    const update = vi.fn().mockResolvedValue({ id: 't' });
    const findUnique = vi.fn().mockResolvedValue(target ? { ...target, deletedAt: null, statusMessage: null } : null);
    const count = vi.fn().mockResolvedValue(owners);
    const findMany = vi.fn().mockResolvedValue([]);
    const record = vi.fn().mockResolvedValue(undefined);
    const prisma = { user: { update, findUnique, count }, accessLog: { findMany } } as unknown as PrismaService;
    return { service: new AdminUsersService(prisma, { record } as unknown as AuditService), update, findMany };
  };

  it('고객 응대 운영자는 운영자 계정을 정지·차단·복구·프로필 지우기 못 함', async () => {
    const { service, update } = setup({ role: 'ADMIN', adminLevel: null });
    await expect(service.suspend(support, 'a2', new Date(), { category: 'ABUSE' })).rejects.toThrow(ForbiddenException);
    await expect(service.ban(support, 'a2', { category: 'ABUSE' })).rejects.toThrow(ForbiddenException);
    await expect(service.reactivate(support, 'a2')).rejects.toThrow(ForbiddenException);
    await expect(service.clearProfile(support, 'a2')).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('고객 응대 운영자는 운영자 접속 기록도 못 봄(일반 회원은 봄)', async () => {
    const admin = setup({ role: 'ADMIN', adminLevel: 'OWNER' });
    await expect(admin.service.accessLogs(support, 'a2')).rejects.toThrow(ForbiddenException);
    expect(admin.findMany).not.toHaveBeenCalled();
    const fan = setup({ role: 'USER', adminLevel: null });
    await fan.service.accessLogs(support, 'u1');
    expect(fan.findMany).toHaveBeenCalled();
  });

  it('자기 자신은 못 다룸(OWNER도)', async () => {
    const { service } = setup({ role: 'ADMIN', adminLevel: 'OWNER' });
    await expect(service.ban(owner, 'owner-1', { category: 'ABUSE' })).rejects.toThrow(ForbiddenException);
    await expect(service.reactivate(owner, 'owner-1')).rejects.toThrow(ForbiddenException);
  });

  it('마지막 OWNER는 정지·차단 못 함, OWNER가 둘 이상이면 됨', async () => {
    const last = setup({ role: 'ADMIN', adminLevel: 'OWNER' }, 1);
    await expect(last.service.ban(owner, 'owner-2', { category: 'ABUSE' })).rejects.toThrow(ForbiddenException);
    const many = setup({ role: 'ADMIN', adminLevel: 'OWNER' }, 2);
    await many.service.ban(owner, 'owner-2', { category: 'ABUSE' });
    expect(many.update).toHaveBeenCalled();
  });

  it('OWNER는 고객 응대 운영자를 정지할 수 있음', async () => {
    const { service, update } = setup({ role: 'ADMIN', adminLevel: 'SUPPORT' }, 1);
    await service.suspend(owner, 'support-2', new Date(), { category: 'ABUSE' });
    expect(update).toHaveBeenCalled();
  });
});
