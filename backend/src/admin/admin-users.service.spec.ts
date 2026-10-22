import { describe, expect, it, vi } from 'vitest';
import { AdminUsersService } from './admin-users.service.js';
import { translateError } from '../common/i18n/error-messages.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';

describe('운영자 제재 — 사유·작업 기록', () => {
  it('정지하면 사유를 저장하고 작업 기록을 남김', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'u1' });
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new AdminUsersService({ user: { update } } as unknown as PrismaService, { record } as unknown as AuditService);
    const until = new Date('2026-10-01T00:00:00Z');
    await service.suspend('admin-1', 'u1', until, { category: 'ABUSE', note: ' 반복 욕설 ' });
    expect(update.mock.calls[0][0].data).toMatchObject({ status: 'SUSPENDED', sanctionCategory: 'ABUSE', sanctionNote: '반복 욕설' });
    expect(record).toHaveBeenCalledWith('admin-1', 'USER_SUSPEND', 'USER', 'u1', expect.objectContaining({ category: 'ABUSE' }));
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
