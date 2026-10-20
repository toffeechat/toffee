import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageSenderType, ReportStatus, Role, SubscriptionEventType } from '../generated/prisma/enums.js';
import { DAY_MS, STATS_TIME_ZONE, startOfTodayInZone, zoneDayExpr, zoneDayStart, zoneDays } from '../common/utils/stats-time.js';
import { WEEKLY_AFTER_DAYS, type StatsRange } from '../actors/agency-stats.service.js';

// 팬 통계는 실제 팬 계정만(배우·소속사·운영자, 탈퇴 계정 제외)
const FAN_WHERE = { role: Role.USER, deletedAt: null } as const;

type DailyRow = { day: string; count: bigint; sum?: bigint | null };
export type OverviewDay = { day: string; signups: number; newRevenueCents: number };

/** 일별 점을 7일씩 묶음(기간 첫날부터) — 소속사 대시보드 bucketWeekly와 같은 규칙 */
export function bucketOverviewWeekly(daily: OverviewDay[]): OverviewDay[] {
  const weeks: OverviewDay[] = [];
  daily.forEach((point, index) => {
    if (index % 7 === 0) weeks.push({ ...point });
    else {
      const week = weeks[weeks.length - 1];
      week.signups += point.signups;
      week.newRevenueCents += point.newRevenueCents;
    }
  });
  return weeks;
}

/**
 * 운영자 통계(2026-09-28, 2차 대시보드 / 2026-10-20 운영자 홈과 합침) — 오늘 숫자(summary), 기간 추이(overview), 전체 팬 분포(breakdown).
 * 에러 추이는 Sentry 화면에서 봄(키 발급 후 연동, ops-infra-backlog).
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const today = startOfTodayInZone();
    const d7 = new Date(today.getTime() - 6 * DAY_MS);
    const d30 = new Date(today.getTime() - 29 * DAY_MS);
    const [fans, newToday, new7d, activeToday, active30d, activeSubs, subscribedFans, startedToday, cancelledToday, started30d, cancelled30d, pendingReports, starToday, repliesToday] =
      await Promise.all([
        this.prisma.user.count({ where: FAN_WHERE }),
        this.prisma.user.count({ where: { ...FAN_WHERE, createdAt: { gte: today } } }),
        this.prisma.user.count({ where: { ...FAN_WHERE, createdAt: { gte: d7 } } }),
        this.prisma.user.count({ where: { ...FAN_WHERE, lastActiveAt: { gte: today } } }),
        this.prisma.user.count({ where: { ...FAN_WHERE, lastActiveAt: { gte: d30 } } }),
        this.prisma.subscription.count({ where: { cancelledAt: null, user: FAN_WHERE } }),
        this.prisma.user.count({ where: { ...FAN_WHERE, subscriptions: { some: { cancelledAt: null } } } }),
        this.prisma.subscriptionEvent.count({ where: { type: SubscriptionEventType.STARTED, createdAt: { gte: today } } }),
        this.prisma.subscriptionEvent.count({ where: { type: SubscriptionEventType.CANCELLED, createdAt: { gte: today } } }),
        this.prisma.subscriptionEvent.count({ where: { type: SubscriptionEventType.STARTED, createdAt: { gte: d30 } } }),
        this.prisma.subscriptionEvent.count({ where: { type: SubscriptionEventType.CANCELLED, createdAt: { gte: d30 } } }),
        this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
        this.prisma.message.count({ where: { senderType: MessageSenderType.ARTIST, createdAt: { gte: today } } }),
        this.prisma.message.count({ where: { senderType: MessageSenderType.FAN, createdAt: { gte: today } } }),
      ]);
    return {
      timeZone: STATS_TIME_ZONE,
      fans: { total: fans, newToday, new7d, activeToday, active30d },
      subscriptions: {
        active: activeSubs,
        subscribedFans,
        // 구독률 = 구독 중인 팬 / 전체 팬
        subscriptionRate: fans ? subscribedFans / fans : 0,
        startedToday,
        cancelledToday,
        started30d,
        cancelled30d,
      },
      reports: { pending: pendingReports },
      messages: { starToday, fanRepliesToday: repliesToday },
    };
  }

  /**
   * 플랫폼 전체 추이(2026-10-20, 운영자 홈 = 통계) — 고른 기간(최근 N일 또는 직접 고른 날짜, 최대 1년, 소속사 대시보드와 같은 resolveRange)의
   * 일별 신규 가입·신규 구독 금액(그날 시작한 구독의 적용 가격 합) + 합계 + 바로 앞 같은 길이 기간 합계(증감 비교).
   * 구독 시작·해지·메시지는 소속사 대시보드 API(/actors/mine/dashboard, 운영자는 전체 방)가 같은 기준으로 셈.
   * 3개월보다 길면 7일씩 묶음(점의 day = 그 주 첫날).
   */
  async overview(range: StatsRange) {
    const fromStart = zoneDayStart(range.from)!;
    const previousFrom = new Date(fromStart.getTime() - range.days * DAY_MS);
    const end = new Date(zoneDayStart(range.to)!.getTime() + DAY_MS);
    const [signups, started] = await Promise.all([
      this.prisma.$queryRawUnsafe<DailyRow[]>(
        `SELECT ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count FROM "User"
         WHERE "createdAt" >= $1 AND "createdAt" < $2 AND role = 'USER' AND "deletedAt" IS NULL GROUP BY 1`,
        previousFrom,
        end,
      ),
      this.prisma.$queryRawUnsafe<DailyRow[]>(
        `SELECT ${zoneDayExpr('"createdAt"')} AS day, count(*) AS count, sum("priceCents") AS sum FROM "SubscriptionEvent"
         WHERE "createdAt" >= $1 AND "createdAt" < $2 AND type = 'STARTED' GROUP BY 1`,
        previousFrom,
        end,
      ),
    ]);
    const daily = new Map<string, OverviewDay>(zoneDays(fromStart, range.days).map((day) => [day, { day, signups: 0, newRevenueCents: 0 }]));
    const totals = { signups: 0, newRevenueCents: 0 };
    const previous = { signups: 0, newRevenueCents: 0 };
    const add = (day: string, key: keyof typeof totals, value: number) => {
      const target = day < range.from ? previous : totals;
      target[key] += value;
      const point = daily.get(day);
      if (point) point[key] += value;
    };
    for (const row of signups) add(row.day, 'signups', Number(row.count));
    for (const row of started) add(row.day, 'newRevenueCents', Number(row.sum ?? 0));
    const points = [...daily.values()];
    const weekly = range.days > WEEKLY_AFTER_DAYS;
    return {
      ...range,
      timeZone: STATS_TIME_ZONE,
      bucket: weekly ? ('week' as const) : ('day' as const),
      totals,
      previous,
      daily: weekly ? bucketOverviewWeekly(points) : points,
    };
  }

  /** 전체 팬 분포 — 국가·가입 기기·가입 경로(첫 소셜 로그인 종류)·언어. 아티스트별 숫자는 대시보드 API(기간 선택)로 */
  async breakdown() {
    const [byCountry, byPlatform, byLocale, byProvider] = await Promise.all([
      this.prisma.user.groupBy({ by: ['countryCode'], where: FAN_WHERE, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['signupPlatform'], where: FAN_WHERE, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['locale'], where: FAN_WHERE, _count: { _all: true } }),
      this.prisma.$queryRawUnsafe<{ provider: string; count: bigint }[]>(
        `SELECT first.provider::text AS provider, count(*) AS count FROM (
           SELECT DISTINCT ON (a."userId") a."userId", a.provider FROM "AuthIdentity" a
           JOIN "User" u ON u.id = a."userId" WHERE u.role = 'USER' AND u."deletedAt" IS NULL
           ORDER BY a."userId", a."createdAt"
         ) first GROUP BY 1`,
      ),
    ]);
    const sorted = (rows: { key: string | null; count: number }[]) =>
      rows.map((row) => ({ key: row.key ?? 'unknown', count: row.count })).sort((a, b) => b.count - a.count);
    return {
      countries: sorted(byCountry.map((r) => ({ key: r.countryCode, count: r._count._all }))),
      platforms: sorted(byPlatform.map((r) => ({ key: r.signupPlatform, count: r._count._all }))),
      locales: sorted(byLocale.map((r) => ({ key: r.locale, count: r._count._all }))),
      // 소셜 로그인 없이 만든 계정(개발용 이메일 로그인)은 여기 안 잡힘
      providers: sorted(byProvider.map((r) => ({ key: r.provider, count: Number(r.count) }))),
    };
  }
}
