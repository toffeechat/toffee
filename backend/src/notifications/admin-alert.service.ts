import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { PushService } from './push.service.js';
import { EmailService } from './email.service.js';

/** 운영자 알림 종류 — 메일 제목 앞머리 */
export type AdminAlertKind = 'REPORT' | 'REFUND' | 'IDLE' | 'INQUIRY' | 'CONTRACT' | 'RETIRE' | 'ERROR';
const KIND_LABEL: Record<AdminAlertKind, string> = { REPORT: '신고', REFUND: '환불', IDLE: '장기 미발송', INQUIRY: '문의', CONTRACT: '계약 종료', RETIRE: '활동 종료', ERROR: '오류' };

/**
 * 운영자 알림(2026-10-20 사용자 요청: 화면을 열어 봐야만 알던 일을 메일·푸시로) — 새 신고(메시지마다 첫 신고), 환불 요청, 환불 기준이 다가오는 장기 미발송,
 * 새 문의·추가 질문, 계약 종료 임박, 예정된 활동 종료 처리, Sentry 새 오류·1시간에 N번 넘는 오류(2026-10-25, SentryIssuesService). 푸시는 정상 상태 운영자 전원(운영자 화면은 한국어라 문구도 한국어),
 * 메일은 ADMIN_ALERT_EMAIL(쉼표로 여럿, 비우면 메일 안 보냄). ADMIN_ALERT_KINDS(예: "REPORT,REFUND")로 종류를 좁힐 수 있음.
 * 알림이 실패해도 본 작업(신고 접수 등)은 막지 않음.
 */
@Injectable()
export class AdminAlertService {
  private readonly logger = new Logger(AdminAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async notify(kind: AdminAlertKind, title: string, body: string, data: Record<string, string> = {}) {
    const kinds = this.config.get<string>('ADMIN_ALERT_KINDS')?.trim();
    if (kinds && !kinds.split(',').map((item) => item.trim()).includes(kind)) return;
    try {
      const admins = await this.prisma.user.findMany({ where: { role: Role.ADMIN, status: UserStatus.ACTIVE, deletedAt: null }, select: { id: true } });
      await this.push.sendToUsers(
        admins.map((admin) => admin.id),
        () => ({ title: `[${KIND_LABEL[kind]}] ${title}`, body }),
        { type: 'admin-alert', kind, ...data },
      );
      const to = this.config.get<string>('ADMIN_ALERT_EMAIL')?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
      for (const address of to) {
        await this.email.send(address, `[토피 ${KIND_LABEL[kind]}] ${title}`, `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p><p style="color:#888">운영자 화면에서 확인해 주세요.</p>`);
      }
    } catch (error) {
      this.logger.warn(`운영자 알림 실패(${kind}): ${String(error)}`);
    }
  }
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
