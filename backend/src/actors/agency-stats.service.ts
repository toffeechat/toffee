import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ensureCanViewActor } from '../common/authorization/actor-access.js';
import { appError } from '../common/i18n/app-error.js';
import { DAY_MS, startOfTodayInZone, zoneDayExpr, zoneDayOf, zoneDayStart, zoneDays } from '../common/utils/stats-time.js';
import { ActorKind, MessageSenderType } from '../generated/prisma/enums.js';
import { ActorsService } from './actors.service.js';

/**
 * 국가·언어 분포에서 이 수보다 적은 묶음은 "기타"로(2026-10-13 잠정 정책) — 구독자가 적은 방에서 "베트남 1명"처럼 특정 팬을
 * 짐작할 수 있게 되는 걸 막음. 서버 설정값으로 바꿀 수 있음.
 */
export const DISTRIBUTION_MIN_COUNT = Math.max(1, Number(process.env.STATS_MIN_GROUP_SIZE ?? 5) || 5);

/** 한 번에 고를 수 있는 최대 기간(2026-10-13 사용자 결정: 1년) */
export const MAX_RANGE_DAYS = 366;
/** 이보다 긴 기간은 추이를 주 단위로 묶음(점이 너무 촘촘해져서) */
export const WEEKLY_AFTER_DAYS = 92;

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
/** 고른 기간(태국 날짜, 양 끝 포함) */
export interface StatsRange {
  from: string;
  to: string;
  days: number;
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
 * 기간 정하기 — from·to(YYYY-MM-DD, 태국 날짜)를 주면 그 기간, 아니면 오늘까지 최근 days일(기본 30).
 * 시작 ≤ 끝 ≤ 오늘, 최대 MAX_RANGE_DAYS일이 아니면 400.
 */
export function resolveRange(query: { days?: number; from?: string; to?: string }, now = new Date()): StatsRange {
  const today = zoneDayOf(now);
  if (query.from || query.to) {
    const fromStart = query.from ? zoneDayStart(query.from) : null;
    const toStart = query.to ? zoneDayStart(query.to) : null;
    const days = fromStart && toStart ? Math.round((toStart.getTime() - fromStart.getTime()) / DAY_MS) + 1 : 0;
    if (!fromStart || !toStart || days < 1 || days > MAX_RANGE_DAYS || query.to! > today) {
      throw new BadRequestException(appError('STATS_RANGE_INVALID', { maxDays: MAX_RANGE_DAYS }));
    }
    return { from: query.from!, to: query.to!, days };
  }
  const days = query.days ?? 30;
  const from = zoneDays(new Date(startOfTodayInZone(now).getTime() - (days - 1) * DAY_MS), 1)[0];
  return { from, to: today, days };
}

/** 기간 → 시각 범위 [start, end) — 첫날 태국 0시 ~ 마지막 날 다음 날 태국 0시 */
export function rangeBounds(range: StatsRange): { start: Date; end: Date } {
  return { start: zoneDayStart(range.from)!, end: new Date(zoneDayStart(range.to)!.getTime() + DAY_MS) };
}

/** 일별 점을 7일씩 묶음(기간 첫날부터, 마지막 묶음은 짧을 수 있음) — 점의 day는 묶음 첫날 */
export function bucketWeekly(daily: DailyActivity[]): DailyActivity[] {
  const weeks: DailyActivity[] = [];
  daily.forEach((point, index) => {
    if (index % 7 === 0) weeks.push({ ...point });
    else {
      const week = weeks[weeks.length - 1];
      week.newSubscriptions += point.newSubscriptions;
      week.cancellations += point.cancellations;
      week.messagesSent += point.messagesSent;
      week.fanReplies += point.fanReplies;
    }
  });
  return weeks;
}

/**
 * 소속사 통계(2026-10-13 개편, 사용자 피드백 "관리자 콘솔처럼 한눈에") — 전체 대시보드와 아티스트별 통계 탭이 같은 계산을 씀.
 * 기간은 태국 날짜(최근 N일 또는 직접 고른 날짜, 최대 1년), 증감 비교는 바로 앞 같은 길이 기간.
 * "구독 중"·팬 나라/언어는 기간 끝이 오늘이면 지금 상태, 지난 날짜면 그날의 하루 기록(ActorDailyStat, 없으면 null).
 */
@Injectable()
export class AgencyStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorsService,
  ) {}

  /** 방별·일별 새 구독·해지·보낸 메시지(지운 것 제외)·팬 답장 — 고른 기간 + 바로 앞 같은 길이 기간 합계 */
  private async activity(ids: string[], range: StatsRange) {
    const fromStart = zoneDayStart(range.from)!;
    const previousFrom = new Date(fromStart.getTime() - range.days * DAY_MS);
    const end = new Date(zoneDayStart(range.to)!.getTime() + DAY_MS);
    const dayList = zoneDays(fromStart, range.days);
    const [events, messages] = await Promise.all([
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT "actorId", type::text AS kind, ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count FROM "SubscriptionEvent"
         WHERE "actorId" = ANY($1::text[]) AND "createdAt" >= $2 AND "createdAt" < $3 GROUP BY 1, 2, 3`,
        ids,
        previousFrom,
        end,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT "actorId", "senderType"::text AS kind, ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count FROM "Message"
         WHERE "actorId" = ANY($1::text[]) AND "createdAt" >= $2 AND "createdAt" < $3
           AND ("senderType" = 'FAN' OR ("senderType" = 'ARTIST' AND "deletedAt" IS NULL))
         GROUP BY 1, 2, 3`,
        ids,
        previousFrom,
        end,
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
      if (row.day < range.from) {
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
    const points = [...daily.values()];
    const weekly = range.days > WEEKLY_AFTER_DAYS;
    return { perActor, totals, previous, daily: weekly ? bucketWeekly(points) : points, bucket: weekly ? ('week' as const) : ('day' as const) };
  }

  /** 지금 구독 중인 팬의 나라·언어(여러 방을 구독한 팬은 한 번) */
  private async liveAudience(ids: string[]) {
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

  /**
   * 지난 날짜의 하루 기록 — 방별 구독 수와 나라·언어를 더함(그래서 여러 방을 구독한 팬은 방마다 셈 — 앱이 문구로 알림).
   * 그날 기록이 하나도 없으면 null(기록을 시작하기 전 날짜).
   */
  private async recordedAudience(ids: string[], day: string) {
    const rows = await this.prisma.actorDailyStat.findMany({ where: { actorId: { in: ids }, day } });
    if (rows.length === 0) return null;
    const sum = (pick: (row: (typeof rows)[number]) => unknown) => {
      const merged = new Map<string, number>();
      for (const row of rows) {
        for (const [key, count] of Object.entries((pick(row) ?? {}) as Record<string, number>)) merged.set(key, (merged.get(key) ?? 0) + Number(count));
      }
      return groupSmall([...merged].map(([key, count]) => ({ key, count })));
    };
    return {
      subscribers: new Map(rows.map((row) => [row.actorId, row.subscribers])),
      fans: rows.reduce((total, row) => total + row.subscribers, 0),
      countries: sum((row) => row.countries),
      languages: sum((row) => row.languages),
    };
  }

  private async liveSubscriberCounts(ids: string[]) {
    const rows = await this.prisma.subscription.groupBy({ by: ['actorId'], where: { actorId: { in: ids }, cancelledAt: null }, _count: { _all: true } });
    return new Map(rows.map((row) => [row.actorId, row._count._all]));
  }

  /**
   * "구독 중"·팬 분포 — 기간 끝이 오늘이면 지금 상태(asOf: null), 지난 날짜면 그날 기록(asOf: 그날, 기록이 없으면 숫자 null)
   */
  private async audienceFor(ids: string[], range: StatsRange) {
    if (range.to >= zoneDayOf(new Date())) {
      const [audience, subscribers] = await Promise.all([this.liveAudience(ids), this.liveSubscriberCounts(ids)]);
      return { asOf: null, recorded: true, subscribers, ...audience, distinctFans: true };
    }
    const recorded = await this.recordedAudience(ids, range.to);
    if (!recorded) return { asOf: range.to, recorded: false, subscribers: null, fans: 0, countries: [], languages: [], distinctFans: false };
    return { asOf: range.to, recorded: true, ...recorded, distinctFans: false };
  }

  /**
   * 전체 대시보드 — 볼 수 있는 방 전체(kind로 아티스트/CP만): 합계·앞 기간·추이·팬 나라/언어·방별 표.
   * 순위(구독자 많은 순 등)는 앱이 방별 표를 정렬해서 그림. agencyId를 주면 그 소속사 방만(CP방은 멤버 소속사 기준, 운영자 홈).
   */
  async dashboard(userId: string, range: StatsRange, kind: 'ALL' | 'SOLO' | 'COUPLE' = 'ALL', agencyId?: string) {
    const actors = (await this.actors.findMine(userId)).filter(
      (actor) =>
        (kind === 'ALL' || actor.kind === (kind === 'SOLO' ? ActorKind.SOLO : ActorKind.COUPLE)) &&
        (!agencyId || actor.agency?.id === agencyId || actor.coupleMembers.some(({ member }) => member.agency?.id === agencyId)),
    );
    const ids = actors.map((actor) => actor.id);
    if (ids.length === 0) {
      return {
        ...range,
        kind,
        bucket: range.days > WEEKLY_AFTER_DAYS ? 'week' : 'day',
        audienceAsOf: null,
        audienceRecorded: true,
        distinctFans: true,
        totals: { subscribers: 0, ...EMPTY },
        previous: { ...EMPTY },
        daily: [],
        fans: 0,
        countries: [],
        languages: [],
        actors: [],
      };
    }
    const [activity, audience] = await Promise.all([this.activity(ids, range), this.audienceFor(ids, range)]);
    const subscribers = audience.subscribers;
    return {
      ...range,
      kind,
      bucket: activity.bucket,
      audienceAsOf: audience.asOf,
      audienceRecorded: audience.recorded,
      distinctFans: audience.distinctFans,
      totals: { subscribers: subscribers ? [...subscribers.values()].reduce((a, b) => a + b, 0) : null, ...activity.totals },
      previous: activity.previous,
      daily: activity.daily,
      fans: audience.fans,
      countries: audience.countries,
      languages: audience.languages,
      actors: actors.map((actor) => ({
        id: actor.id,
        kind: actor.kind,
        chatDisplayName: actor.chatDisplayName,
        legalName: actor.legalName,
        chatProfileImageUrl: actor.chatProfileImageUrl,
        retiredAt: actor.retiredAt,
        lastBroadcastAt: actor.lastBroadcastAt,
        // 지난 날짜인데 기록이 없으면 0(순위 정렬용) — 앱은 audienceRecorded로 안내
        subscriberCount: subscribers?.get(actor.id) ?? 0,
        ...(activity.perActor.get(actor.id) ?? EMPTY),
      })),
    };
  }

  /** 아티스트별 통계 탭 — 대시보드와 같은 숫자 + 메시지 종류 비율·답장이 많았던 메시지 */
  async actorStats(userId: string, actorId: string, range: StatsRange) {
    await ensureCanViewActor(this.prisma, userId, actorId);
    const from = zoneDayStart(range.from)!;
    const end = new Date(zoneDayStart(range.to)!.getTime() + DAY_MS);
    const inRange = { gte: from, lt: end };
    const [activity, audience, lastBroadcast, mediaMix, topMessages] = await Promise.all([
      this.activity([actorId], range),
      this.audienceFor([actorId], range),
      this.prisma.message.findFirst({
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.message.groupBy({
        by: ['mediaType'],
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: inRange },
        _count: { _all: true },
      }),
      this.prisma.message.findMany({
        where: { actorId, senderType: MessageSenderType.ARTIST, deletedAt: null, createdAt: inRange },
        orderBy: [{ replies: { _count: 'desc' } }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, body: true, mediaType: true, createdAt: true, _count: { select: { replies: { where: { senderType: MessageSenderType.FAN } } } } },
      }),
    ]);
    return {
      ...range,
      bucket: activity.bucket,
      audienceAsOf: audience.asOf,
      audienceRecorded: audience.recorded,
      distinctFans: audience.distinctFans,
      subscriberCount: audience.subscribers ? (audience.subscribers.get(actorId) ?? 0) : null,
      lastBroadcastAt: lastBroadcast?.createdAt ?? null,
      totals: activity.totals,
      previous: activity.previous,
      daily: activity.daily,
      fans: audience.fans,
      countries: audience.countries,
      languages: audience.languages,
      mediaMix: mediaMix.map((row) => ({ key: row.mediaType, count: row._count._all })).sort((a, b) => b.count - a.count),
      topMessages: topMessages
        .filter((message) => message._count.replies > 0)
        .map(({ _count, ...message }) => ({ ...message, replyCount: _count.replies })),
    };
  }
}
