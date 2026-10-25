import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../storage/media.service.js';

// 확정 규칙(2026-09-21, docs/product/feature-decisions.md "대화기록 보존 기간"): 팬 답장은 그 팬이 그 배우 구독을
// 해지한 지 1년이 지나면 삭제, 다시 구독 중이면 제외. 스타 메시지는 스타가 지우기 전까지 유지.
export const FAN_REPLY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
// 지운(회수한) 메시지의 사진·영상 보관 기간(2026-10-25 잠정 90일, STATUS.md 출시 전 확정 정책) — DELETED_MEDIA_RETENTION_DAYS로 조정
export const DELETED_MEDIA_RETENTION_DAYS = 90;
const PURGE_BATCH = 200;

@Injectable()
export class MessageRetentionService {
  private readonly logger = new Logger(MessageRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly config: ConfigService,
  ) {}

  private get deletedMediaRetentionDays(): number {
    const value = Number(this.config.get<string>('DELETED_MEDIA_RETENTION_DAYS'));
    return Number.isInteger(value) && value > 0 ? value : DELETED_MEDIA_RETENTION_DAYS;
  }

  /**
   * 매일 새벽(태국 시간 04:10) — 구독 해지 1년이 지난 팬의 그 채널 답장 삭제. 탈퇴한 팬도 탈퇴 때 구독이 해지 처리되므로
   * 같은 규칙으로 1년 뒤 삭제됨. 처리 대기 중인 신고가 걸린 답장은 운영자가 볼 수 있게 남김(처리 후 다음 날 삭제).
   * 이 답장을 스타가 인용했으면 인용 부분은 "삭제된 메시지"로 바뀜(replyToMessageId SetNull). 팬 답장은 텍스트뿐이라
   * 지울 파일은 없음.
   */
  @Cron('10 4 * * *', { timeZone: 'Asia/Bangkok' })
  async removeExpiredFanReplies(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - FAN_REPLY_RETENTION_MS);
    const count = await this.prisma.$executeRaw`
      DELETE FROM "Message" m
      USING "Subscription" s
      WHERE m."senderType" = 'FAN'
        AND s."userId" = m."fanUserId"
        AND s."actorId" = m."actorId"
        AND s."cancelledAt" IS NOT NULL
        AND s."cancelledAt" < ${cutoff}
        AND NOT EXISTS (SELECT 1 FROM "Report" r WHERE r."messageId" = m.id AND r.status = 'PENDING')`;
    if (count > 0) this.logger.log(`구독 해지 1년 지난 팬 답장 ${count}건 삭제`);
    return count;
  }

  /**
   * 매일 새벽(태국 시간 04:20) — 지운 지 보관 기간이 지난 메시지의 사진·영상·썸네일 파일 삭제(2026-10-25). 메시지 줄(글·누가·사유)은
   * 그대로 남고 파일 키만 비움. 신고가 걸린 메시지는 증거라 계속 보관(예전 규칙 그대로). 지우자마자 파일을 없애던 예전 방식은 사고·분쟁 때
   * 무엇이 나갔는지 확인할 수 없어서 바꿈
   */
  @Cron('20 4 * * *', { timeZone: 'Asia/Bangkok' })
  async purgeDeletedMedia(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.deletedMediaRetentionDays * 24 * 60 * 60 * 1000);
    let purged = 0;
    for (;;) {
      const messages = await this.prisma.message.findMany({
        where: {
          deletedAt: { lt: cutoff },
          OR: [{ mediaKey: { not: null } }, { thumbnailKey: { not: null } }],
          reports: { none: {} },
        },
        select: { id: true, mediaKey: true, thumbnailKey: true },
        take: PURGE_BATCH,
      });
      for (const message of messages) {
        await this.mediaService.deleteQuietly(message.mediaKey);
        await this.mediaService.deleteQuietly(message.thumbnailKey);
      }
      if (messages.length) {
        await this.prisma.message.updateMany({ where: { id: { in: messages.map((m) => m.id) } }, data: { mediaKey: null, thumbnailKey: null } });
      }
      purged += messages.length;
      if (messages.length < PURGE_BATCH) break;
    }
    if (purged > 0) this.logger.log(`보관 기간 지난 회수 메시지 파일 ${purged}건 삭제`);
    return purged;
  }
}
