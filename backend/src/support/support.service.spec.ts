import { describe, expect, it, vi } from 'vitest';
import { SupportService } from './support.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PushService } from '../notifications/push.service.js';
import type { AdminAlertService } from '../notifications/admin-alert.service.js';
import type { MediaService } from '../storage/media.service.js';

function setup() {
  const prisma = {
    supportInquiry: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: 'q1', status: 'OPEN', title: '영수증' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'q1', title: '영수증', userId: 'u1', messages: [] }),
      create: vi.fn().mockResolvedValue({ id: 'q1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    supportAttachment: { findMany: vi.fn().mockResolvedValue([{ objectKey: 'users/u1/support/a.jpg' }, { objectKey: 'users/admin/support/b.jpg' }]) },
  };
  const media = {
    verifyAt: vi.fn().mockResolvedValue(undefined),
    deleteQuietly: vi.fn().mockResolvedValue(undefined),
    resolveImageUrl: vi.fn((key: string) => Promise.resolve(`https://signed/${key}`)),
  };
  const audit = { record: vi.fn() };
  const service = new SupportService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    { sendToUsers: vi.fn() } as unknown as PushService,
    { notify: vi.fn() } as unknown as AdminAlertService,
    media as unknown as MediaService,
  );
  return { service, prisma, media, audit };
}

describe('1:1 문의 사진(2026-10-25)', () => {
  it('새 문의에 붙인 사진은 쓴 사람 경로인지 확인하고 순서대로 저장', async () => {
    const { service, prisma, media } = setup();
    prisma.supportInquiry.findFirst.mockResolvedValueOnce({ id: 'q1', messages: [{ id: 'm1', attachments: [{ id: 'a1', objectKey: 'users/u1/support/x.jpg' }] }] });
    const result = await service.create('u1', { category: 'PAYMENT', title: '영수증', body: '결제가 두 번 됐어요', photoKeys: ['users/u1/support/x.jpg', 'users/u1/support/y.jpg', 'users/u1/support/x.jpg'] });
    expect(media.verifyAt).toHaveBeenCalledTimes(2);
    expect(media.verifyAt).toHaveBeenCalledWith('users/u1/support/', 'PHOTO', 'users/u1/support/x.jpg');
    const created = prisma.supportInquiry.create.mock.calls[0][0].data.messages.create;
    expect(created.attachments.create).toEqual([
      { objectKey: 'users/u1/support/x.jpg', sortOrder: 0 },
      { objectKey: 'users/u1/support/y.jpg', sortOrder: 1 },
    ]);
    // 응답엔 키 대신 임시 URL
    expect(result.messages[0].attachments).toEqual([{ id: 'a1', url: 'https://signed/users/u1/support/x.jpg' }]);
  });

  it('4장이면 거절', async () => {
    const { service } = setup();
    await expect(service.addMine('u1', 'q1', '', ['a', 'b', 'c', 'd'])).rejects.toThrow();
  });

  it('추가 질문은 사진만 보내도 되지만, 글도 사진도 없으면 거절', async () => {
    const { service, prisma } = setup();
    await expect(service.addMine('u1', 'q1', '  ')).rejects.toThrow();
    prisma.supportInquiry.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'OPEN', title: '영수증' }).mockResolvedValueOnce({ id: 'q1', messages: [] });
    await service.addMine('u1', 'q1', '', ['users/u1/support/x.jpg']);
    expect(prisma.supportInquiry.update.mock.calls[0][0].data.messages.create.body).toBe('');
  });

  it('운영자 답변 사진은 운영자 경로로 확인', async () => {
    const { service, media } = setup();
    await service.adminReply('admin', 'q1', '확인했어요', ['users/admin/support/z.png']);
    expect(media.verifyAt).toHaveBeenCalledWith('users/admin/support/', 'PHOTO', 'users/admin/support/z.png');
  });

  it('문의를 지우면 회원·운영자 사진 파일도 지움', async () => {
    const { service, prisma, media } = setup();
    await service.deleteMine('u1', 'q1');
    expect(prisma.supportInquiry.delete).toHaveBeenCalledWith({ where: { id: 'q1' } });
    expect(media.deleteQuietly).toHaveBeenCalledWith('users/u1/support/a.jpg');
    expect(media.deleteQuietly).toHaveBeenCalledWith('users/admin/support/b.jpg');
  });

  it('남의 문의는 못 지움', async () => {
    const { service, prisma } = setup();
    prisma.supportInquiry.findFirst.mockResolvedValueOnce(null);
    await expect(service.deleteMine('u2', 'q1')).rejects.toThrow();
    expect(prisma.supportInquiry.delete).not.toHaveBeenCalled();
  });
});

describe('운영자 문의함 종류 필터(2026-10-25)', () => {
  const rows = [
    { status: 'OPEN', category: 'PAYMENT', _count: { _all: 3 } },
    { status: 'OPEN', category: 'BUG', _count: { _all: 2 } },
    { status: 'ANSWERED', category: 'PAYMENT', _count: { _all: 4 } },
    { status: 'CLOSED', category: 'REFUND', _count: { _all: 1 } },
  ];

  it('상태 개수는 고른 종류 안에서, 종류 개수는 고른 상태 안에서', async () => {
    const { service, prisma } = setup();
    prisma.supportInquiry.groupBy.mockResolvedValue(rows);
    const result = await service.adminList('OPEN', 'PAYMENT');
    expect(prisma.supportInquiry.findMany.mock.calls[0][0].where).toEqual({ status: 'OPEN', category: 'PAYMENT' });
    expect(result.counts).toEqual({ ALL: 7, OPEN: 3, ANSWERED: 4, CLOSED: 0 });
    expect(result.categoryCounts).toEqual({ ALL: 5, ACCOUNT: 0, PAYMENT: 3, REFUND: 0, ARTIST: 0, BUG: 2, OTHER: 0 });
  });

  it('필터 없으면 전체 개수', async () => {
    const { service, prisma } = setup();
    prisma.supportInquiry.groupBy.mockResolvedValue(rows);
    const result = await service.adminList();
    expect(result.counts.ALL).toBe(10);
    expect(result.categoryCounts).toMatchObject({ ALL: 10, PAYMENT: 7, REFUND: 1 });
  });
});
