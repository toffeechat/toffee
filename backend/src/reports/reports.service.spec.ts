import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { MessageSenderType, ReportCategory, Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RealtimeService } from '../realtime/realtime.service.js';
import type { AdminAlertService } from '../notifications/admin-alert.service.js';

function setup(role: Role, subscription: { startedAt: Date; cancelledAt: Date | null } | null, earlierPending = 0) {
  const createdAt = new Date('2026-10-28T00:00:00Z');
  const prisma = {
    message: {
      findUnique: vi.fn().mockResolvedValue({ id: 'm1', actorId: 'a1', senderType: MessageSenderType.ARTIST, fanUserId: null, createdAt: new Date('2026-10-01') }),
    },
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role }) },
    subscription: { findUnique: vi.fn().mockResolvedValue(subscription) },
    report: {
      create: vi.fn().mockResolvedValue({ id: 'r2', category: ReportCategory.SPAM, status: 'PENDING', createdAt }),
      count: vi.fn().mockResolvedValue(earlierPending),
    },
    actor: { findUnique: vi.fn().mockResolvedValue({ chatDisplayName: '캐러멜' }) },
  } as unknown as PrismaService;
  const alerts = { notify: vi.fn().mockResolvedValue(undefined) } as unknown as AdminAlertService;
  const service = new ReportsService(prisma, {} as AuditService, {} as RealtimeService, alerts);
  return { service, prisma, alerts, createdAt };
}

const active = { startedAt: new Date('2026-09-01'), cancelledAt: null };

describe('ReportsService.create(2026-10-28)', () => {
  it('다른 방을 구독한 아티스트·소속사 계정도 그 방 아티스트 메시지를 신고할 수 있음', async () => {
    for (const role of [Role.ACTOR, Role.AGENCY_STAFF]) {
      const { service, prisma } = setup(role, active);
      await service.create('u1', 'm1', ReportCategory.SPAM);
      expect(prisma.report.create).toHaveBeenCalled();
    }
  });

  it('구독하지 않은 아티스트 계정은 예전처럼 REPORT_NOT_ALLOWED', async () => {
    const { service, prisma } = setup(Role.ACTOR, null);
    await expect(service.create('u1', 'm1', ReportCategory.SPAM)).rejects.toThrow(ForbiddenException);
    await expect(service.create('u1', 'm1', ReportCategory.SPAM)).rejects.toMatchObject({ response: { code: 'REPORT_NOT_ALLOWED' } });
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('운영자 알림은 이 신고보다 먼저 들어온 대기 신고가 없을 때만 — 동시에 두 건이 와도 0건이 되지 않게', async () => {
    const first = setup(Role.USER, active, 0);
    await first.service.create('u1', 'm1', ReportCategory.SPAM);
    expect(first.alerts.notify).toHaveBeenCalledTimes(1);
    expect(first.prisma.report.count).toHaveBeenCalledWith({
      where: {
        messageId: 'm1',
        status: 'PENDING',
        OR: [{ createdAt: { lt: first.createdAt } }, { createdAt: first.createdAt, id: { lt: 'r2' } }],
      },
    });

    const later = setup(Role.USER, active, 1);
    await later.service.create('u1', 'm1', ReportCategory.SPAM);
    expect(later.alerts.notify).not.toHaveBeenCalled();
  });
});
