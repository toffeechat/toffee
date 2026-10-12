import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { UpsertNoticeDto } from './dto/upsert-notice.dto.js';

const SELECT = { id: true, title: true, body: true, pinned: true, createdAt: true, updatedAt: true } as const;
const LIST_LIMIT = 100;

/**
 * 공지사항(2026-10-12, 버블 비교 점검 → 1차) — 점검·약관/개인정보처리방침 변경·아티스트 서비스 종료 등을 운영자가 씀.
 * 고정한 공지가 맨 위, 나머지는 최신순. 언어별로 따로 쓰지 않음(필요하면 본문에 여러 언어로).
 */
@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.notice.findMany({ select: SELECT, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: LIST_LIMIT });
  }

  async create(adminId: string, dto: UpsertNoticeDto) {
    const notice = await this.prisma.notice.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), pinned: dto.pinned ?? false, createdById: adminId },
      select: SELECT,
    });
    await this.audit.record(adminId, 'NOTICE_CREATE', 'NOTICE', notice.id, { title: notice.title });
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
