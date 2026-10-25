import { describe, expect, it, vi } from 'vitest';
import { UploadCleanupService } from './upload-cleanup.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from './storage.service.js';

const NOW = new Date('2026-09-28T00:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

function setup(objects: { key: string; lastModified: Date }[]) {
  const prisma = {
    message: { findMany: vi.fn().mockResolvedValue([{ mediaKey: 'actors/a1/message/used.jpg', thumbnailKey: 'actors/a1/message/thumb.jpg' }]) },
    story: { findMany: vi.fn().mockResolvedValue([]) },
    actor: { findMany: vi.fn().mockResolvedValue([{ officialProfileImageUrl: 'https://placehold.co/x', chatProfileImageUrl: 'actors/a1/profile/p.jpg' }]) },
    agency: { findMany: vi.fn().mockResolvedValue([{ logoUrl: null }]) },
    user: { findMany: vi.fn().mockResolvedValue([{ profileImageUrl: 'users/u1/profile/me.jpg' }]) },
    supportAttachment: { findMany: vi.fn().mockResolvedValue([{ objectKey: 'users/u1/support/receipt.jpg' }]) },
  } as unknown as PrismaService;
  const deleted: string[] = [];
  const storage = {
    isConfigured: true,
    // prefix별로 해당 객체만
    listObjects: async function* (prefix: string) {
      for (const o of objects) if (o.key.startsWith(prefix)) yield o;
    },
    delete: vi.fn((key: string) => {
      deleted.push(key);
      return Promise.resolve();
    }),
  } as unknown as StorageService;
  return { service: new UploadCleanupService(prisma, storage), deleted };
}

describe('UploadCleanupService', () => {
  it('하루 지난 미사용 파일만 지우고, 쓰는 파일·막 올린 파일은 남김', async () => {
    const { service, deleted } = setup([
      { key: 'actors/a1/message/used.jpg', lastModified: hoursAgo(48) },
      { key: 'actors/a1/message/thumb.jpg', lastModified: hoursAgo(48) },
      { key: 'actors/a1/message/orphan.jpg', lastModified: hoursAgo(48) },
      { key: 'actors/a1/message/fresh.jpg', lastModified: hoursAgo(2) },
      { key: 'actors/a1/profile/p.jpg', lastModified: hoursAgo(72) },
      { key: 'agencies/g1/logo/old.png', lastModified: hoursAgo(30) },
      // 팬 프로필 사진(2026-10-12) — 쓰는 사진은 남기고, 바꾸고 남은 옛 사진은 지움
      { key: 'users/u1/profile/me.jpg', lastModified: hoursAgo(72) },
      { key: 'users/u1/profile/old.jpg', lastModified: hoursAgo(72) },
      // 문의 사진(2026-10-25) — 문의에 붙은 건 남기고, 올리고 안 보낸 건 지움
      { key: 'users/u1/support/receipt.jpg', lastModified: hoursAgo(72) },
      { key: 'users/u1/support/unsent.jpg', lastModified: hoursAgo(72) },
    ]);
    await expect(service.removeOrphanUploads(NOW)).resolves.toBe(4);
    expect(deleted.sort()).toEqual(['actors/a1/message/orphan.jpg', 'agencies/g1/logo/old.png', 'users/u1/profile/old.jpg', 'users/u1/support/unsent.jpg']);
  });
});
