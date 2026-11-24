import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '../lifecycle/cron.js';
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';
import { captureException } from '@sentry/nestjs';
import { PrismaService } from '../../prisma/prisma.service.js';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;
type HitRow = { hits: number; expiresAt: Date; blockedUntil: Date | null; now: Date };

/**
 * 요청 횟수 제한 기록을 Postgres에(2026-11-24 점검 5차) — @nestjs/throttler 기본 저장소는 서버 메모리라 서버가 N대면 번역·업로드 같은
 * 비용이 드는 한도도 N배가 됐음. 정해진 시간 창(ttl) 안의 횟수를 한 줄(key)로 세고, 한도를 넘으면 blockDuration 동안 막음.
 * DB 오류가 나면 모든 요청이 막히지 않게 이 서버 메모리 저장소로 넘어감(그 사이엔 예전처럼 서버별 한도).
 */
@Injectable()
export class PrismaThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PrismaThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private lastFailureLoggedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    try {
      return await this.incrementInDb(key, ttl, limit, blockDuration);
    } catch (error) {
      // 같은 장애로 요청마다 Sentry가 쌓이지 않게 1분에 한 번만 알림
      if (Date.now() - this.lastFailureLoggedAt > 60_000) {
        this.lastFailureLoggedAt = Date.now();
        this.logger.error(`요청 제한 기록(DB) 실패 — 잠시 서버 메모리로: ${error instanceof Error ? error.message : String(error)}`);
        captureException(error, { tags: { job: 'rate-limit-store' } });
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  private async incrementInDb(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord> {
    // 한 문장으로 원자적으로: 막혀 있으면 그대로, 시간 창이 지났으면 1부터 다시, 아니면 +1
    const [row] = await this.prisma.$queryRaw<HitRow[]>`
      INSERT INTO "RateLimitHit" ("key", "hits", "expiresAt", "blockedUntil")
      VALUES (${key}, 1, now() + ${ttl} * interval '1 millisecond', NULL)
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN COALESCE("RateLimitHit"."blockedUntil" > now(), false) THEN "RateLimitHit"."hits"
          WHEN "RateLimitHit"."expiresAt" <= now() THEN 1
          ELSE "RateLimitHit"."hits" + 1 END,
        "expiresAt" = CASE
          WHEN "RateLimitHit"."expiresAt" <= now() AND NOT COALESCE("RateLimitHit"."blockedUntil" > now(), false) THEN EXCLUDED."expiresAt"
          ELSE "RateLimitHit"."expiresAt" END,
        "blockedUntil" = CASE WHEN COALESCE("RateLimitHit"."blockedUntil" > now(), false) THEN "RateLimitHit"."blockedUntil" ELSE NULL END
      RETURNING "hits", "expiresAt", "blockedUntil", now() AS "now"`;
    let blockedUntil = row.blockedUntil;
    if (!blockedUntil && row.hits > limit && blockDuration > 0) {
      const [blocked] = await this.prisma.$queryRaw<{ blockedUntil: Date }[]>`
        UPDATE "RateLimitHit" SET "blockedUntil" = now() + ${blockDuration} * interval '1 millisecond'
        WHERE "key" = ${key} RETURNING "blockedUntil"`;
      blockedUntil = blocked?.blockedUntil ?? null;
    }
    const now = row.now.getTime();
    const seconds = (at: Date) => Math.max(0, Math.ceil((at.getTime() - now) / 1000));
    const isBlocked = blockDuration > 0 ? !!blockedUntil && blockedUntil.getTime() > now : row.hits > limit;
    return {
      totalHits: row.hits,
      timeToExpire: seconds(row.expiresAt),
      isBlocked,
      timeToBlockExpire: isBlocked ? (blockedUntil ? seconds(blockedUntil) : seconds(row.expiresAt)) : 0,
    };
  }

  // 지난 기록 지우기 — 시간 창·막힘이 모두 끝난 지 1시간 넘은 것
  @Cron('23 * * * *')
  async cleanup() {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM "RateLimitHit"
        WHERE "expiresAt" < now() - interval '1 hour' AND ("blockedUntil" IS NULL OR "blockedUntil" < now() - interval '1 hour')`;
    } catch (error) {
      this.logger.error(`요청 제한 기록 정리 실패: ${error instanceof Error ? error.message : String(error)}`);
      captureException(error, { tags: { job: 'rate-limit-cleanup' } });
    }
  }
}
