import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { TranslationService } from '../translation/translation.service.js';
import { resolveLocale, SUPPORTED_LOCALES } from '../common/i18n/locales.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ShutdownService } from '../common/lifecycle/shutdown.service.js';
import type { UpsertNoticeDto } from './dto/upsert-notice.dto.js';

const SELECT = { id: true, title: true, body: true, pinned: true, pushedAt: true, createdAt: true, updatedAt: true } as const;
const LIST_LIMIT = 100;

/**
 * 공지사항(2026-10-12, 버블 비교 점검 → 1차) — 점검·약관/개인정보처리방침 변경·아티스트 서비스 종료 등을 운영자가 씀.
 * 고정한 공지가 맨 위, 나머지는 최신순. 언어별로 따로 쓰지 않음(필요하면 본문에 여러 언어로).
 */
@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly push: PushService,
    private readonly translation: TranslationService,
    private readonly shutdown: ShutdownService,
  ) {}

  /**
   * 공지 푸시(2026-10-20 사용자 요청: 점검·약관 변경은 알림이 필요) — 모든 계정에게 한 번. 제목은 받는 사람 언어로(공지 번역과 같은 저장분을 씀,
   * 번역이 안 되면 원문). pushedAt을 먼저 잡아서 두 번 눌러도 한 번만. 보내기는 기다리지 않음(사람이 많으면 오래 걸려서)
   */
  private async pushNotice(adminId: string, notice: { id: string; title: string }) {
    const { count } = await this.prisma.notice.updateMany({ where: { id: notice.id, pushedAt: null }, data: { pushedAt: new Date() } });
    if (count === 0) return;
    await this.audit.record(adminId, 'NOTICE_PUSH', 'NOTICE', notice.id, { title: notice.title });
    // 번역(최대 8개 언어)까지 종료 대기에 넣음(2026-10-28) — 예전엔 발송만 넣어서, 번역하는 사이 배포로 꺼지면 pushedAt만 남고 푸시가 영영 안 감
    void this.shutdown.track((async () => {
      const titles = new Map<string, string>([['ko', notice.title]]);
      for (const locale of SUPPORTED_LOCALES) {
        if (locale === 'ko' || !this.translation.enabled) continue;
        const translated = await this.translation.translateNotice(notice.id, locale).catch(() => null);
        if (translated) titles.set(locale, translated.title);
      }
      await this.push.sendToEveryone(
        (recipient) => {
          const locale = resolveLocale(recipient.locale);
          return { title: pushStrings(locale).noticeTitle, body: titles.get(locale) ?? notice.title };
        },
        { type: 'notice', noticeId: notice.id },
      );
    })()).catch((error) => this.logger.warn(`공지 푸시 실패: ${String(error)}`));
  }

  list() {
    return this.prisma.notice.findMany({ select: SELECT, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: LIST_LIMIT });
  }

  async create(adminId: string, dto: UpsertNoticeDto) {
    const notice = await this.prisma.notice.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), pinned: dto.pinned ?? false, createdById: adminId },
      select: SELECT,
    });
    await this.audit.record(adminId, 'NOTICE_CREATE', 'NOTICE', notice.id, { title: notice.title });
    if (dto.push) await this.pushNotice(adminId, notice);
    return notice;
  }

  async update(adminId: string, id: string, dto: UpsertNoticeDto) {
    await this.ensureExists(id);
    const notice = await this.prisma.notice.update({
      where: { id },
      data: { title: dto.title.trim(), body: dto.body.trim(), ...(dto.pinned === undefined ? {} : { pinned: dto.pinned }) },
      select: SELECT,
    });
    await this.audit.record(adminId, 'NOTICE_UPDATE', 'NOTICE', id, { title: notice.title });
    if (dto.push) await this.pushNotice(adminId, notice);
    return notice;
  }

  async remove(adminId: string, id: string) {
    const notice = await this.ensureExists(id);
    await this.prisma.notice.delete({ where: { id } });
    await this.audit.record(adminId, 'NOTICE_DELETE', 'NOTICE', id, { title: notice.title });
  }

  private async ensureExists(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id }, select: { title: true } });
    if (!notice) throw new NotFoundException();
    return notice;
  }
}
