import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../storage/media.service.js';

@Injectable()
export class StoryCleanupService {
  private readonly logger = new Logger(StoryCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  // 만료된 스토리 정리 — 저장소의 실제 파일을 먼저 지우고 DB 레코드 삭제(StoryView는 onDelete:
  // Cascade로 같이 지워짐). 파일 삭제가 실패해도 DB는 지움(고아 파일은 버킷 수명주기 규칙으로 정리 —
  // ops-infra-backlog 참고). 외부 URL(mediaUrl)만 있는 옛 스토리는 지울 파일이 없음.
  @Cron(CronExpression.EVERY_HOUR)
  async removeExpiredStories(now = new Date()): Promise<number> {
    const expired = await this.prisma.story.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, mediaKey: true },
    });
    if (expired.length === 0) return 0;
    // 같은 파일 키를 아직 안 끝난 다른 스토리가 쓰면 남김(2026-10-27 — 같은 키를 두 번 올리면 먼저 끝난 쪽이 파일을 지웠음)
    const keys = [...new Set(expired.map((story) => story.mediaKey).filter((key): key is string => !!key))];
    const live = keys.length
      ? await this.prisma.story.findMany({ where: { mediaKey: { in: keys }, expiresAt: { gt: now } }, select: { mediaKey: true } })
      : [];
    const keep = new Set(live.map((story) => story.mediaKey));
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => this.mediaService.deleteQuietly(key)));
    const { count } = await this.prisma.story.deleteMany({ where: { id: { in: expired.map((story) => story.id) } } });
    this.logger.log(`만료된 스토리 ${count}건 정리`);
    return count;
  }
}
