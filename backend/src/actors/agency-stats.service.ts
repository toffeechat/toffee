import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ensureCanViewActor } from '../common/authorization/actor-access.js';
import { DAY_MS, startOfTodayInZone, zoneDayExpr, zoneDays } from '../common/utils/stats-time.js';
import { ActorKind, MessageSenderType } from '../generated/prisma/enums.js';
import { ActorsService } from './actors.service.js';
import type { StatsPeriod } from './dto/agency-stats-query.dto.js';

/**
 * 국가·언어 분포에서 이 수보다 적은 묶음은 "기타"로(2026-10-13 잠정 정책) — 구독자가 적은 방에서 "베트남 1명"처럼 특정 팬을
 * 짐작할 수 있게 되는 걸 막음. 서버 설정값으로 바꿀 수 있음.
 */
export const DISTRIBUTION_MIN_COUNT = Math.max(1, Number(process.env.STATS_MIN_GROUP_SIZE ?? 5) || 5);

export interface ActivityTotals {
  newSubscriptions: number;
  cancellations: number;
  messagesSent: number;
  fanReplies: number;
}
export interface DailyActivity extends ActivityTotals {
  day: string;
}
export interface DistributionRow {
  key: string;
  count: number;
}

const EMPTY: ActivityTotals = { newSubscriptions: 0, cancellations: 0, messagesSent: 0, fanReplies: 0 };

type CountRow = { actorId: string; kind: string; day: string; count: bigint };

/** 작은 묶음은 "other"로 합치고(위 DISTRIBUTION_MIN_COUNT), 값이 없으면 "unknown", 많은 순 */
export function groupSmall(rows: { key: string | null; count: number }[], min = DISTRIBUTION_MIN_COUNT): DistributionRow[] {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const key = row.key ?? 'unknown';
    merged.set(key, (merged.get(key) ?? 0) + row.count);
  }
  let other = 0;
  const result: DistributionRow[] = [];
  for (const [key, count] of merged) {
    if (count < min || key === 'other') other += count;
    else result.push({ key, count });
  }
  result.sort((a, b) => b.count - a.count);
  if (other > 0) result.push({ key: 'other', count: other });
  return result;
}

/**
 * 소속사 통계(2026-10-13 개편, 사용자 피드백 "관리자 콘솔처럼 한눈에") — 전체 대시보드와 아티스트별 통계 탭이 같은 계산을 씀.
 * 기간은 태국 날짜 기준 최근 N일(오늘 포함), 증감 비교는 바로 앞 N일.
 */
@Injectable()
export class AgencyStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorsService,
  ) {}

  private window(days: number) {
    const from = new Date(startOfTodayInZone().getTime() - (days - 1) * DAY_MS);
    const previousFrom = new Date(from.getTime() - days * DAY_MS);
    return { from, previousFrom, dayList: zoneDays(from, days) };
  }

  /** 방별·일별 새 구독·해지·보낸 메시지(지운 것 제외)·팬 답장 — 이번 기간 + 바로 앞 기간 합계 */
  private async activity(ids: string[], days: number) {
    const { previousFrom, dayList } = this.window(days);
    const firstDay = dayList[0];
    const [events, messages] = await Promise.all([
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT "actorId", type::text AS kind, ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count FROM "SubscriptionEvent"
         WHERE "actorId" = ANY($1::text[]) AND "createdAt" >= $2 GROUP BY 1, 2, 3`,
        ids,
        previousFrom,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT "actorId", "senderType"::text AS kind, ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count FROM "Message"
         WHERE "actorId" = ANY($1::text[]) AND "createdAt" >= $2
           AND ("senderType" = 'FAN' OR ("senderType" = 'ARTIST' AND "deletedAt" IS NULL))
         GROUP BY 1, 2, 3`,
        ids,
        previousFrom,
      ),
    ]);
    const field = (kind: string): keyof ActivityTotals | null =>
      kind === 'STARTED'
        ? 'newSubscriptions'
        : kind === 'CANCELLED'
          ? 'cancellations'
          : kind === MessageSenderType.ARTIST
            ? 'messagesSent'
            : kind === MessageSenderType.FAN
              ? 'fanReplies'
              : null;

    const perActor = new Map<string, ActivityTotals>();
    const daily = new Map<string, DailyActivity>(dayList.map((day) => [day, { day, ...EMPTY }]));
    const totals: ActivityTotals = { ...EMPTY };
    const previous: ActivityTotals = { ...EMPTY };
    for (const row of [...events, ...messages]) {
      const key = field(row.kind);
      if (!key) continue;
      const count = Number(row.count);
      if (row.day < firstDay) {
        previous[key] += count;
        continue;
      }
      totals[key] += count;
      const point = daily.get(row.day);
      if (point) point[key] += count;
      const actor = perActor.get(row.actorId) ?? { ...EMPTY };
      actor[key] += count;
      perActor.set(row.actorId, actor);
    }
    return { perActor, totals, previous, daily: [...daily.values()] };
  }

  /** 지금 구독 중인 팬의 나라·언어(여러 방을 구독한 팬은 한 번) */
  private async audience(ids: string[]) {
    const query = (column: string) =>
      this.prisma.$queryRawUnsafe<{ key: string | null; count: bigint }[]>(
        `SELECT u."${column}" AS key, count(DISTINCT u.id) AS count FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
         WHERE s."actorId" = ANY($1::text[]) AND s."cancelledAt" IS NULL AND u."deletedAt" IS NULL GROUP BY 1`,
        ids,
      );
    const [countries, languages] = await Promise.all([query('countryCode'), query('locale')]);
    const toRows = (rows: { key: string | null; count: bigint }[]) => rows.map((row) => ({ key: row.key, count: Number(row.count) }));
    return {
      fans: countries.reduce((sum, row) => sum + Number(row.count), 0),
      countries: groupSmall(toRows(countries)),
      languages: groupSmall(toRows(languages)),
    };
  }

  private async subscriberCounts(ids: string[]) {
    const rows = await this.prisma.subscription.groupBy({ by: ['actorId'], where: { actorId: { in: ids }, cancelledAt: null }, _count: { _all: true } });
    return new Map(rows.map((row) => [row.actorId, row._count._all]));
  }

  /**
   * 전체 대시보드 — 볼 수 있는 방 전체(kind로 아티스트/CP만): 합계·앞 기간 대비·일별 추이·팬 나라/언어·방별 표.
   * 순위(구독자 많은 순 등)는 앱이 방별 표를 정렬해서 그림.
   */
  async dashboard(userId: string, days: StatsPeriod = 30, kind: 'ALL' | 'SOLO' | 'COUPLE' = 'ALL') {
    const actors = (await this.actors.findMine(userId)).filter((actor) => kind === 'ALL' || actor.kind === (kind === 'SOLO' ? ActorKind.SOLO : ActorKind.COUPLE));
    const ids = actors.map((actor) => actor.id);
    if (ids.length === 0) {
      return {
        days,
        kind,
        totals: { subscribers: 0, ...EMPTY },
        previous: { ...EMPTY },
        daily: this.window(days).dayList.map((day) => ({ day, ...EMPTY })),
        fans: 0,
        countries: [],
        languages: [],
        actors: [],
      };
    }
    const [activity, audience, subscribers] = await Promise.all([this.activity(ids, days), this.audience(ids), this.subscriberCounts(ids)]);
    return {
      days,
      kind,
      totals: { subscribers: [...subscribers.values()].reduce((a, b) => a + b, 0), ...activity.totals },
      previous: activity.previous,
      daily: activity.daily,
      ...audience,
      actors: actors.map((actor) => ({
        id: actor.id,
        kind: actor.kind,
        chatDisplayName: actor.chatDisplayName,
        legalName: actor.legalName,
        chatProfileImageUrl: actor.chatProfileImageUrl,
        retiredAt: actor.retiredAt,
        lastBroadcastAt: actor.lastBroadcastAt,
        subscriberCount: subscribers.get(actor.id) ?? 0,
        ...(activity.perActor.get(actor.id) ?? EMPTY),
      })),
    };
  }

  /** 아티스트별 통계 탭 — 대시보드와 같은 숫자 + 메시지 종류 비율·답장이 많았던 메시지 */
  async actorStats(userId: string, actorId: string, days: StatsPeriod = 30) {
    await ensureCanViewActor(this.prisma, userId, actorId);
    const { from } = this.window(days);
    const [activity, audience, subscriberCount, lastBroadcast, mediaMix, topMessages] = await Promise.all([
      this.activity([actorId], days),
      this.audience([actorId]),
      this.prisma.subscription.count({ where: { actorId, cancelledAt: null } }),
      this.prisma.message.findFirst({
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.message.groupBy({
        by: ['mediaType'],
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.message.findMany({
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: { gte: from } },
        orderBy: [{ replies: { _count: 'desc' } }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, body: true, mediaType: true, createdAt: true, _count: { select: { replies: { where: { senderType: MessageSenderType.FAN } } } } },
      }),
    ]);
    return {
      days,
      subscriberCount,
      lastBroadcastAt: lastBroadcast?.createdAt ?? null,
      totals: activity.totals,
      previous: activity.previous,
      daily: activity.daily,
      ...audience,
      mediaMix: mediaMix.map((row) => ({ key: row.mediaType, count: row._count._all })).sort((a, b) => b.count - a.count),
      topMessages: topMessages
        .filter((message) => message._count.replies > 0)
        .map(({ _count, ...message }) => ({ ...message, replyCount: _count.replies })),
    };
  }
}
