import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { MessageRetentionService } from './message-retention.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';

const DAY = 24 * 60 * 60 * 1000;

function setup(rows: { id: string; mediaKey: string | null; thumbnailKey: string | null }[], days?: string) {
  const findMany = vi.fn().mockResolvedValueOnce(rows).mockResolvedValue([]);
  const updateMany = vi.fn().mockResolvedValue({ count: rows.length });
  const prisma = { message: { findMany, updateMany } } as unknown as PrismaService;
  const deleteQuietly = vi.fn().mockResolvedValue(undefined);
  const config = { get: (key: string) => (key === 'DELETED_MEDIA_RETENTION_DAYS' ? days : undefined) } as unknown as ConfigService;
  const service = new MessageRetentionService(prisma, { deleteQuietly } as unknown as MediaService, config);
  return { service, findMany, updateMany, deleteQuietly };
}

describe('MessageRetentionService.purgeDeletedMedia 지운 메시지 파일 보관 후 정리(2026-10-25)', () => {
  it('기본 90일 지난, 신고 없는 회수 메시지만 찾아 파일을 지우고 키를 비움', async () => {
    const now = new Date('2026-10-25T00:00:00Z');
    const { service, findMany, updateMany, deleteQuietly } = setup([{ id: 'm1', mediaKey: 'a.jpg', thumbnailKey: 't.jpg' }]);
    expect(await service.purgeDeletedMedia(now)).toBe(1);
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.deletedAt).toEqual({ lt: new Date(now.getTime() - 90 * DAY) });
    expect(where.reports).toEqual({ none: {} });
    expect(deleteQuietly).toHaveBeenCalledWith('a.jpg');
    expect(deleteQuietly).toHaveBeenCalledWith('t.jpg');
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['m1'] } }, data: { mediaKey: null, thumbnailKey: null } });
  });

  it('보관 일수는 설정값으로', async () => {
    const now = new Date('2026-10-25T00:00:00Z');
    const { service, findMany, updateMany } = setup([], '30');
    expect(await service.purgeDeletedMedia(now)).toBe(0);
    expect((findMany.mock.calls[0][0] as { where: { deletedAt: unknown } }).where.deletedAt).toEqual({ lt: new Date(now.getTime() - 30 * DAY) });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
