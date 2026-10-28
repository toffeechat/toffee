import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MessageSenderType, ReportCategory, ReportStatus, Role } from '../generated/prisma/enums.js';
import { ensureCanViewActor } from '../common/authorization/actor-access.js';
import { ensureActiveSubscription } from '../common/authorization/ensure-active-subscription.js';
import { appError } from '../common/i18n/app-error.js';

import { AuditService } from '../audit/audit.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = { SPAM: '스팸·광고', ABUSE: '욕설·괴롭힘', SEXUAL: '음란·성적', PRIVACY: '개인정보 노출', OTHER: '기타' };

export interface AdminReportFilter {
  status?: ReportStatus;
  category?: ReportCategory;
  agencyId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    private readonly alerts: AdminAlertService,
  ) {}

  /**
   * 신고는 운영자 대기열로만 감(신고한 쪽이 직접 제재하지 않음). 신고자가 그 메시지를 실제로 볼 수 있는
   * 사람인지 확인 — 팬은 구독 중인 배우가 보낸(구독 이후) 메시지만, 배우 본인·소속사는 자기 채널의 팬
   * 답장만. 같은 사람이 같은 메시지를 두 번 신고할 수는 없음(순위 부풀리기 방지).
   */
  async create(reportedById: string, messageId: string, category: ReportCategory, reason?: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, actorId: true, senderType: true, fanUserId: true, createdAt: true },
    });
    if (!message) throw new NotFoundException(appError('REPORT_TARGET_NOT_FOUND'));
    const reporter = await this.prisma.user.findUniqueOrThrow({ where: { id: reportedById }, select: { role: true } });

    if (message.fanUserId === reportedById) throw new BadRequestException(appError('REPORT_OWN_MESSAGE'));
    if (reporter.role !== Role.ADMIN) {
      if (message.senderType === MessageSenderType.ARTIST) {
        // 다른 방을 팬으로 구독한 아티스트·소속사 계정도 그 방 메시지는 신고 가능(2026-10-28 — 예전엔 USER만). 구독 안 했으면 예전처럼 REPORT_NOT_ALLOWED
        const subscription = await ensureActiveSubscription(this.prisma, reportedById, message.actorId).catch((error: unknown) => {
          if (reporter.role === Role.USER) throw error;
          throw new ForbiddenException(appError('REPORT_NOT_ALLOWED'));
        });
        if (message.createdAt < subscription.startedAt) throw new ForbiddenException(appError('REPORT_NOT_ALLOWED'));
      } else {
        if (reporter.role !== Role.ACTOR && reporter.role !== Role.AGENCY_STAFF) {
          throw new ForbiddenException(appError('REPORT_NOT_ALLOWED'));
        }
        await ensureCanViewActor(this.prisma, reportedById, message.actorId);
      }
    }

    try {
      const report = await this.prisma.report.create({
        data: { messageId, reportedById, category, reason: reason?.trim() || null },
        select: { id: true, category: true, status: true, createdAt: true },
      });
      // 운영자 알림(2026-10-20) — 메시지마다 처리 대기 중 첫 신고일 때만(같은 메시지에 신고가 몰려도 한 번).
      // "대기 중 신고가 1개"로 보면 동시에 두 건이 들어올 때 둘 다 2개로 세서 알림이 0건이 될 수 있어서, 이 신고보다 먼저 들어온
      // 대기 신고가 없을 때로 판단(2026-10-28) — 가장 먼저 들어온 신고는 늘 0을 보므로 적어도 한 번은 감
      const earlierPending = await this.prisma.report.count({
        where: {
          messageId,
          status: ReportStatus.PENDING,
          OR: [{ createdAt: { lt: report.createdAt } }, { createdAt: report.createdAt, id: { lt: report.id } }],
        },
      });
      if (earlierPending === 0) {
        const room = await this.prisma.actor.findUnique({ where: { id: message.actorId }, select: { chatDisplayName: true } });
        void this.alerts.notify(
          'REPORT',
          `${room?.chatDisplayName ?? ''} 방 ${message.senderType === MessageSenderType.ARTIST ? '아티스트 메시지' : '팬 답장'} 신고`,
          `사유: ${REPORT_CATEGORY_LABEL[category]}${reason?.trim() ? ` — ${reason.trim().slice(0, 200)}` : ''}`,
          { reportId: report.id },
        );
      }
      return report;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException(appError('REPORT_DUPLICATE'));
      throw error;
    }
  }

  /**
   * 운영자 신고 화면(2026-10-20 개편: 요약 카드·소속사/아티스트/사유/기간 필터·처리한 내역까지). 신고 횟수로 자동 제재하지 않는 대신(잠정 정책)
   * 같은 메시지 신고는 한 줄로 묶고(가장 먼저 들어온 신고 기준) 여러 명이 신고한 것부터. counts는 상태만 빼고 같은 필터를 건 줄 수(카드 숫자),
   * byActor는 지금 필터의 방별 줄 수(많은 순). 최근 2,000건까지만 봄(운영 초기 규모 — 커지면 서버에서 나눠 불러오기).
   */
  async findForAdmin(filter: AdminReportFilter = {}) {
    const where: Prisma.ReportWhereInput = {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
      message: {
        ...(filter.actorId ? { actorId: filter.actorId } : {}),
        // CP방은 멤버 소속사 기준
        ...(filter.agencyId ? { actor: { OR: [{ agencyId: filter.agencyId }, { coupleMembers: { some: { member: { agencyId: filter.agencyId } } } }] } } : {}),
      },
    };
    const reports = await this.prisma.report.findMany({
      where,
      include: {
        message: {
          select: {
            id: true,
            actorId: true,
            senderType: true,
            body: true,
            mediaType: true,
            createdAt: true,
            fanUser: { select: { id: true, nickname: true, displayName: true, status: true } },
            actor: {
              select: {
                chatDisplayName: true,
                legalName: true,
                kind: true,
                agency: { select: { id: true, name: true } },
                coupleMembers: { select: { member: { select: { agency: { select: { id: true, name: true } } } } } },
              },
            },
          },
        },
        reportedBy: { select: { id: true, displayName: true, nickname: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    type Row = (typeof reports)[number];
    const groups = new Map<string, { first: Row; reportIds: string[]; categories: Set<ReportCategory> }>();
    for (const report of [...reports].reverse()) {
      // 같은 메시지라도 처리 전후 신고는 따로(승인 뒤 새로 들어온 신고는 다시 대기)
      const key = `${report.messageId}|${report.status}`;
      const group = groups.get(key);
      if (group) {
        group.reportIds.push(report.id);
        group.categories.add(report.category);
      } else {
        groups.set(key, { first: report, reportIds: [report.id], categories: new Set([report.category]) });
      }
    }
    const all = [...groups.values()];
    const counts = { ALL: all.length, PENDING: 0, RESOLVED: 0, DISMISSED: 0 };
    for (const group of all) counts[group.first.status] += 1;
    const shown = all.filter((group) => !filter.status || group.first.status === filter.status);
    const byActor = new Map<string, { actorId: string; name: string; count: number }>();
    for (const { first } of shown) {
      const row = byActor.get(first.message.actorId) ?? { actorId: first.message.actorId, name: first.message.actor.chatDisplayName, count: 0 };
      row.count += 1;
      byActor.set(first.message.actorId, row);
    }
    return {
      counts,
      byActor: [...byActor.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      items: shown
        // 대기 중은 여러 명이 신고한 것·오래된 것부터, 처리한 건 최근 처리 순
        .sort((a, b) =>
          a.first.status === ReportStatus.PENDING && b.first.status === ReportStatus.PENDING
            ? b.reportIds.length - a.reportIds.length || a.first.createdAt.getTime() - b.first.createdAt.getTime()
            : (b.first.resolvedAt ?? b.first.createdAt).getTime() - (a.first.resolvedAt ?? a.first.createdAt).getTime(),
        )
        .map(({ first, reportIds, categories }) => {
          const { coupleMembers, agency, ...actor } = first.message.actor;
          const agencies = agency ? [agency.name] : [...new Set(coupleMembers.flatMap(({ member }) => (member.agency ? [member.agency.name] : [])))];
          return {
            ...first,
            message: { ...first.message, actor: { ...actor, agencyNames: agencies } },
            reportCount: reportIds.length,
            reportIds,
            categories: [...categories],
          };
        }),
    };
  }

  // 같은 메시지에 걸린 대기 중 신고를 한 번에 처리(목록이 메시지 단위로 묶여 있으므로).
  // 승인하면 메시지를 가림 — 팬 답장은 스타·소속사 답장 목록에서 빠지고 인용 부분은 "가려진 메시지"로(toQuote), 스타 메시지는 팬 화면에서 사라지고
  // 스타·소속사 화면엔 "운영 정책으로 가려진 메시지"로 남음(예전엔 스타 메시지 신고는 승인해도 아무 일 없었음).
  async resolve(id: string, adminId: string) {
    const report = await this.ensurePending(id);
    const now = new Date();
    const message = await this.prisma.message.findUniqueOrThrow({
      where: { id: report.messageId },
      select: { senderType: true, deletedAt: true, actorId: true },
    });
    await this.prisma.$transaction([
      this.prisma.report.updateMany({
        where: { messageId: report.messageId, status: ReportStatus.PENDING },
        data: { status: ReportStatus.RESOLVED, resolvedAt: now },
      }),
      ...(message.senderType === MessageSenderType.ARTIST && !message.deletedAt
        ? [this.prisma.message.update({ where: { id: report.messageId }, data: { deletedAt: now, deletedByAdmin: true } })]
        : []),
    ]);
    // 스타 메시지는 팬 화면에서 사라지고, 팬 답장은 인용 부분이 가려짐 — 열려 있는 화면에 바로 반영
    void this.realtime.publish({ kind: 'message-removed', actorId: message.actorId });
    await this.audit.record(adminId, 'REPORT_RESOLVE', 'REPORT', id, { messageId: report.messageId, senderType: message.senderType });
    return this.prisma.report.findUniqueOrThrow({ where: { id } });
  }

  async dismiss(id: string, adminId: string) {
    const report = await this.ensurePending(id);
    await this.prisma.report.updateMany({
      where: { messageId: report.messageId, status: ReportStatus.PENDING },
      data: { status: ReportStatus.DISMISSED, resolvedAt: new Date() },
    });
    await this.audit.record(adminId, 'REPORT_DISMISS', 'REPORT', id, { messageId: report.messageId });
    return this.prisma.report.findUniqueOrThrow({ where: { id } });
  }

  private async ensurePending(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(appError('REPORT_NOT_FOUND'));
    if (report.status !== ReportStatus.PENDING) {
      throw new ConflictException(appError('REPORT_ALREADY_HANDLED'));
    }
    return report;
  }
}
