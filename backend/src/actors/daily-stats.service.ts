import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { zoneDayOf } from '../common/utils/stats-time.js';

type SnapshotRow = { actorId: string; country: string | null; language: string | null; active: boolean; count: bigint };
type Counts = Record<string, number>;

/**
 * 방별 그 순간의 구독 수·구독 팬 나라·언어. at이 없으면 지금 상태(해지 안 한 구독), 있으면 그 시각에 이어지고 있던 구독
 * (시작 ≤ at < 해지) — 후자는 재구독하면 시작일이 덮어써져서 근사치라 데모 데이터 채우기에만 씀.
 * 구독 수는 소속사 화면의 "구독 중"과 같은 기준(탈퇴 계정 포함), 나라·언어는 탈퇴 안 한 팬만.
 */
export async function computeAudienceSnapshot(prisma: Prisma.TransactionClient, at?: Date) {
  const rows = at
    ? await prisma.$queryRawUnsafe<SnapshotRow[]>(
        `SELECT s."actorId", u."countryCode" AS country, u.locale AS language, u."deletedAt" IS NULL AS active, count(*) AS count
         FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
         WHERE s."startedAt" <= $1 AND (s."cancelledAt" IS NULL OR s."cancelledAt" > $1) GROUP BY 1, 2, 3, 4`,
        at,
      )
    : await prisma.$queryRawUnsafe<SnapshotRow[]>(
        `SELECT s."actorId", u."countryCode" AS country, u.locale AS language, u."deletedAt" IS NULL AS active, count(*) AS count
         FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
         WHERE s."cancelledAt" IS NULL GROUP BY 1, 2, 3, 4`,
      );
  const byActor = new Map<string, { subscribers: number; countries: Counts; languages: Counts }>();
  for (const row of rows) {
    const entry = byActor.get(row.actorId) ?? { subscribers: 0, countries: {}, languages: {} };
    const count = Number(row.count);
    entry.subscribers += count;
    if (row.active) {
      const country = row.country ?? 'unknown';
      const language = row.language ?? 'unknown';
      entry.countries[country] = (entry.countries[country] ?? 0) + count;
      entry.languages[language] = (entry.languages[language] ?? 0) + count;
    }
    byActor.set(row.actorId, entry);
  }
  return byActor;
}

/** day(태국 날짜) 줄을 모든 방에 대해 덮어씀 — 구독이 없는 방도 0으로 남겨서 "기록 없음"과 구분 */
export async function writeDailyStats(prisma: Prisma.TransactionClient, day: string, at?: Date): Promise<number> {
  const [actors, snapshot] = await Promise.all([prisma.actor.findMany({ select: { id: true } }), computeAudienceSnapshot(prisma, at)]);
  for (const { id } of actors) {
    const entry = snapshot.get(id) ?? { subscribers: 0, countries: {}, languages: {} };
    await prisma.actorDailyStat.upsert({
      where: { actorId_day: { actorId: id, day } },
      create: { actorId: id, day, ...entry },
      update: entry,
    });
  }
  return actors.length;
}

/**
 * 하루 기록(2026-10-13 사용자 결정) — 매시간 50분(태국 시간)에 오늘 줄을 덮어써서, 그날 마지막 기록이 하루 마감 상태가 됨.
 * 서버가 잠깐 꺼져 있어도 그날 다른 시간에 한 번이라도 돌면 남음. 같은 줄을 덮어써서 서버가 여러 대여도 안전.
 */
@Injectable()
export class DailyStatsService {
  private readonly logger = new Logger(DailyStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('50 * * * *', { timeZone: 'Asia/Bangkok' })
  async recordToday(now = new Date()): Promise<void> {
    try {
      await writeDailyStats(this.prisma, zoneDayOf(now));
    } catch (error) {
      this.logger.error(`하루 통계 기록 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
