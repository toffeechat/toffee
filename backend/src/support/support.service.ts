import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
import { MediaService } from '../storage/media.service.js';
import { supportUploadPrefix } from '../storage/media-policy.js';
import { InquiryStatus } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';

export const INQUIRY_CATEGORIES = ['ACCOUNT', 'PAYMENT', 'REFUND', 'ARTIST', 'BUG', 'OTHER'] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];
const CATEGORY_LABEL: Record<InquiryCategory, string> = { ACCOUNT: '계정', PAYMENT: '결제', REFUND: '환불', ARTIST: '아티스트·대화', BUG: '오류', OTHER: '기타' };

// 글 하나에 붙일 수 있는 사진(2026-10-25 — 결제 영수증·오류 화면)
export const INQUIRY_PHOTO_MAX = 3;

const MESSAGE_SELECT = {
  id: true,
  fromAdmin: true,
  body: true,
  createdAt: true,
  attachments: { select: { id: true, objectKey: true }, orderBy: { sortOrder: 'asc' } },
} as const;

type WithAttachmentKeys = { messages: { attachments: { id: string; objectKey: string }[] }[] };

const photoNote = (count: number) => (count > 0 ? ` (사진 ${count}장)` : '');

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
    private readonly media: MediaService,
  ) {}

  // ── 사진 ──

  /** 회원·운영자 공통 — 쓴 사람 경로로 업로드 URL 발급. 받은 objectKey를 글 보낼 때 photoKeys로 넘김 */
  createPhotoUpload(userId: string, contentType: string, sizeBytes: number) {
    return this.media.createUploadAt(supportUploadPrefix(userId), 'PHOTO', contentType, sizeBytes);
  }

  /** 3장까지, 쓴 사람이 문의용으로 올린 실제 사진인지 확인(중복 키는 하나로) */
  private async verifyPhotos(authorId: string, keys: string[] | undefined): Promise<string[]> {
    const unique = [...new Set(keys ?? [])];
    if (unique.length > INQUIRY_PHOTO_MAX) throw new BadRequestException(appError('INQUIRY_PHOTO_LIMIT', { max: INQUIRY_PHOTO_MAX }));
    for (const key of unique) await this.media.verifyAt(supportUploadPrefix(authorId), 'PHOTO', key);
    return unique;
  }

  private messageData(authorId: string, body: string, photoKeys: string[], fromAdmin = false) {
    if (!body.trim() && photoKeys.length === 0) throw new BadRequestException(appError('INQUIRY_EMPTY'));
    return {
      authorId,
      fromAdmin,
      body: body.trim(),
      attachments: { create: photoKeys.map((objectKey, sortOrder) => ({ objectKey, sortOrder })) },
    };
  }

  /** 저장소 키 → 임시 조회 URL(저장소 미설정이면 null — 화면엔 "사진을 불러올 수 없어요") */
  private async withPhotoUrls<T extends WithAttachmentKeys>(inquiry: T) {
    const messages = await Promise.all(
      inquiry.messages.map(async ({ attachments, ...message }) => ({
        ...message,
        attachments: await Promise.all(attachments.map(async ({ id, objectKey }) => ({ id, url: await this.media.resolveImageUrl(objectKey) }))),
      })),
    );
    return { ...inquiry, messages };
  }

  /** 문의 하나를 지우고(글·첨부는 cascade) 사진 파일도 지움 — 지우지 못한 파일은 고아 정리가 다음 날 지움 */
  private async deleteInquiry(id: string) {
    const photos = await this.prisma.supportAttachment.findMany({ where: { message: { inquiryId: id } }, select: { objectKey: true } });
    await this.prisma.supportInquiry.delete({ where: { id } });
    // 같은 사진 키를 다른 문의 글에도 붙였으면 그 파일은 남김(2026-10-27 — 예전엔 하나를 지우면 다른 문의 사진까지 사라졌음)
    const keys = [...new Set(photos.map((photo) => photo.objectKey))];
    if (keys.length === 0) return;
    const stillUsed = await this.prisma.supportAttachment.findMany({ where: { objectKey: { in: keys } }, select: { objectKey: true } });
    const keep = new Set(stillUsed.map((row) => row.objectKey));
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => this.media.deleteQuietly(key)));
  }

  listMine(userId: string) {
    return this.prisma.supportInquiry.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, category: true, title: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  async create(userId: string, input: { category: InquiryCategory; title: string; body: string; photoKeys?: string[] }) {
    const photoKeys = await this.verifyPhotos(userId, input.photoKeys);
    const inquiry = await this.prisma.supportInquiry.create({
      data: { userId, category: input.category, title: input.title.trim(), messages: { create: this.messageData(userId, input.body, photoKeys) } },
      select: { id: true },
    });
    void this.alerts.notify(
      'INQUIRY',
      `새 문의 · ${CATEGORY_LABEL[input.category]}`,
      `${input.title.trim()}\n${input.body.trim().slice(0, 300)}${photoNote(photoKeys.length)}`,
      { inquiryId: inquiry.id },
    );
    return this.findMine(userId, inquiry.id);
  }

  async findMine(userId: string, id: string) {
    const inquiry = await this.prisma.supportInquiry.findFirst({
      where: { id, userId },
      select: { id: true, category: true, title: true, status: true, createdAt: true, updatedAt: true, messages: { select: MESSAGE_SELECT, orderBy: { createdAt: 'asc' } } },
    });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    return this.withPhotoUrls(inquiry);
  }

  async addMine(userId: string, id: string, body: string, photoKeys?: string[]) {
    const inquiry = await this.prisma.supportInquiry.findFirst({ where: { id, userId }, select: { status: true, title: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    if (inquiry.status === InquiryStatus.CLOSED) throw new BadRequestException(appError('INQUIRY_CLOSED'));
    const photos = await this.verifyPhotos(userId, photoKeys);
    await this.prisma.supportInquiry.update({ where: { id }, data: { status: InquiryStatus.OPEN, messages: { create: this.messageData(userId, body, photos) } } });
    void this.alerts.notify('INQUIRY', `문의 추가 질문 · ${inquiry.title}`, `${body.trim().slice(0, 300)}${photoNote(photos.length)}`, { inquiryId: id });
    return this.findMine(userId, id);
  }

  /** 내 문의 지우기(2026-10-25 — 사진이 개인정보라) — 답을 기다리는 중이어도 지울 수 있음 */
  async deleteMine(userId: string, id: string) {
    const inquiry = await this.prisma.supportInquiry.findFirst({ where: { id, userId }, select: { id: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    await this.deleteInquiry(id);
    return { deleted: true };
  }

  // ── 운영자 ──

  /**
   * 상태·종류(2026-10-25) 필터. 개수는 서로 걸러서 — 상태 칩 개수는 고른 종류 안에서, 종류 칩 개수는 고른 상태 안에서
   * ("결제"를 고르면 상태 칩이 결제 문의 기준 숫자로 바뀜)
   */
  async adminList(status?: InquiryStatus, category?: InquiryCategory) {
    const [items, grouped] = await Promise.all([
      this.prisma.supportInquiry.findMany({
        where: { ...(status ? { status } : {}), ...(category ? { category } : {}) },
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
      this.prisma.supportInquiry.groupBy({ by: ['status', 'category'], _count: { _all: true } }),
    ]);
    const counts = { ALL: 0, OPEN: 0, ANSWERED: 0, CLOSED: 0 };
    const categoryCounts: Record<'ALL' | InquiryCategory, number> = { ALL: 0, ACCOUNT: 0, PAYMENT: 0, REFUND: 0, ARTIST: 0, BUG: 0, OTHER: 0 };
    for (const row of grouped) {
      const n = row._count._all;
      if (!category || row.category === category) {
        counts[row.status] += n;
        counts.ALL += n;
      }
      if (!status || row.status === status) {
        // 예전 값이 남아 있으면 "기타"로
        const key = (INQUIRY_CATEGORIES as readonly string[]).includes(row.category) ? (row.category as InquiryCategory) : 'OTHER';
        categoryCounts[key] += n;
        categoryCounts.ALL += n;
      }
    }
    return { counts, categoryCounts, items };
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
    return this.withPhotoUrls(inquiry);
  }

  async adminReply(adminId: string, id: string, body: string, photoKeys?: string[]) {
    const inquiry = await this.prisma.supportInquiry.findUnique({ where: { id }, select: { userId: true, title: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    const photos = await this.verifyPhotos(adminId, photoKeys);
    await this.prisma.supportInquiry.update({
      where: { id },
      data: { status: InquiryStatus.ANSWERED, messages: { create: this.messageData(adminId, body, photos, true) } },
    });
    await this.audit.record(adminId, 'INQUIRY_REPLY', 'INQUIRY', id, photos.length > 0 ? { photos: photos.length } : undefined);
    void this.push.sendToUsers(
      [inquiry.userId],
      (recipient) => {
        const strings = pushStrings(recipient.locale);
        return { title: strings.inquiryReplyTitle, body: body.trim().slice(0, 120) || strings.media.PHOTO };
      },
      { type: 'inquiry-reply', inquiryId: id },
    );
    return this.adminFind(id);
  }

  async adminClose(adminId: string, id: string) {
    await this.prisma.supportInquiry.update({ where: { id }, data: { status: InquiryStatus.CLOSED } });
    await this.audit.record(adminId, 'INQUIRY_CLOSE', 'INQUIRY', id);
    return this.adminFind(id);
  }

  /** 운영자가 문의 지우기(2026-10-25 — 장난·개인정보 삭제 요청). 지운 뒤엔 제목을 못 찾으니 작업 기록에 제목을 남김 */
  async adminDelete(adminId: string, id: string) {
    const inquiry = await this.prisma.supportInquiry.findUnique({ where: { id }, select: { title: true, userId: true } });
    if (!inquiry) throw new NotFoundException(appError('NOT_FOUND'));
    await this.deleteInquiry(id);
    await this.audit.record(adminId, 'INQUIRY_DELETE', 'INQUIRY', id, { title: inquiry.title, userId: inquiry.userId });
    return { deleted: true };
  }
}
