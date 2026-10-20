import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
import { InquiryStatus } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';

export const INQUIRY_CATEGORIES = ['ACCOUNT', 'PAYMENT', 'REFUND', 'ARTIST', 'BUG', 'OTHER'] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];
const CATEGORY_LABEL: Record<InquiryCategory, string> = { ACCOUNT: '계정', PAYMENT: '결제', REFUND: '환불', ARTIST: '아티스트·대화', BUG: '오류', OTHER: '기타' };

const MESSAGE_SELECT = { id: true, fromAdmin: true, body: true, createdAt: true } as const;

/**
 * 1:1 문의(2026-10-20 사용자 결정, 이메일만 있던 것) — 팬·아티스트·소속사가 앱에서 쓰고 운영자가 답함. 운영자가 답하면 ANSWERED + 문의한 사람에게 푸시,
 * 문의한 사람이 다시 쓰면 OPEN(운영자 알림). CLOSED면 더 못 씀(새로 문의). 운영자 이름은 안 보이고 "토피 운영팀".
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly push: PushService,
    private readonly alerts: AdminAlertService,
  ) {}

  listMine(userId: string) {
    return this.prisma.supportInquiry.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, category: true, title: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  async create(userId: string, input: { category: InquiryCategory; title: string; body: string }) {
    const inquiry = await this.prisma.supportInquiry.create({
      data: { userId, category: input.category, title: input.title.trim(), messages: { create: { authorId: userId, body: input.body.trim() } } },
      select: { id: true },
    });
    void this.alerts.notify('INQUIRY', `새 문의 · ${CATEGORY_LABEL[input.category]}`, `${input.title.trim()}\n${input.body.trim().slice(0, 300)}`, { inquiryId: inquiry.id });
    return this.findMine(userId, inquiry.id);
  }

  async findMine(userId: string, id: string) {
    const inquiry = await this.prisma.supportInquiry.findFirst({
      where: { id, userId },
      select: { id: true, category: true, title: true, status: true, createdAt: true, updatedAt: true, messages: { select: MESSAGE_SELECT, orderBy: { createdAt: 'asc' } } },
    });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    return inquiry;
  }

  async addMine(userId: string, id: string, body: string) {
    const inquiry = await this.prisma.supportInquiry.findFirst({ where: { id, userId }, select: { status: true, title: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    if (inquiry.status === InquiryStatus.CLOSED) throw new BadRequestException(appError('INQUIRY_CLOSED'));
    await this.prisma.supportInquiry.update({ where: { id }, data: { status: InquiryStatus.OPEN, messages: { create: { authorId: userId, body: body.trim() } } } });
    void this.alerts.notify('INQUIRY', `문의 추가 질문 · ${inquiry.title}`, body.trim().slice(0, 300), { inquiryId: id });
    return this.findMine(userId, id);
  }

  // ── 운영자 ──

  async adminList(status?: InquiryStatus) {
    const [items, grouped] = await Promise.all([
      this.prisma.supportInquiry.findMany({
        where: status ? { status } : {},
        // 답 기다리는 건 오래된 것부터, 나머지는 최근 순
        orderBy: status === InquiryStatus.OPEN ? { updatedAt: 'asc' } : { updatedAt: 'desc' },
        take: 300,
        select: {
          id: true,
          category: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, displayName: true, nickname: true, role: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportInquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = { ALL: 0, OPEN: 0, ANSWERED: 0, CLOSED: 0 };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
      counts.ALL += row._count._all;
    }
    return { counts, items };
  }

  async adminFind(id: string) {
    const inquiry = await this.prisma.supportInquiry.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, displayName: true, nickname: true, role: true, email: true, locale: true } },
        messages: { select: { ...MESSAGE_SELECT, authorId: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    return inquiry;
  }

  async adminReply(adminId: string, id: string, body: string) {
    const inquiry = await this.prisma.supportInquiry.findUnique({ where: { id }, select: { userId: true, title: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    await this.prisma.supportInquiry.update({
      where: { id },
      data: { status: InquiryStatus.ANSWERED, messages: { create: { authorId: adminId, fromAdmin: true, body: body.trim() } } },
    });
    await this.audit.record(adminId, 'INQUIRY_REPLY', 'INQUIRY', id);
    void this.push.sendToUsers(
      [inquiry.userId],
      (recipient) => ({ title: pushStrings(recipient.locale).inquiryReplyTitle, body: body.trim().slice(0, 120) }),
      { type: 'inquiry-reply', inquiryId: id },
    );
    return this.adminFind(id);
  }

  async adminClose(adminId: string, id: string) {
    await this.prisma.supportInquiry.update({ where: { id }, data: { status: InquiryStatus.CLOSED } });
    await this.audit.record(adminId, 'INQUIRY_CLOSE', 'INQUIRY', id);
    return this.adminFind(id);
  }
}
