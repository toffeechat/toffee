import { describe, expect, it, vi } from 'vitest';
import { AdminStatsService, bucketOverviewWeekly } from './admin-stats.service.js';
import { resolveRange } from '../actors/agency-stats.service.js';
import { DAY_MS, zoneDayStart, zoneDays } from '../common/utils/stats-time.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('운영자 홈 추이(가입·신규 구독 금액)', () => {
  const range = resolveRange({ days: 7 });
  const days = zoneDays(zoneDayStart(range.from)!, 7);
  const before = zoneDays(new Date(zoneDayStart(range.from)!.getTime() - 3 * DAY_MS), 1)[0];

  function setup() {
    const queryRawUnsafe = vi.fn((sql: string) =>
      Promise.resolve(
        sql.includes('"User"')
          ? [
              { day: days[0], count: 4n },
              { day: before, count: 2n },
            ]
          : [
              { day: days[6], count: 2n, sum: 25800n },
              { day: before, count: 1n, sum: 12900n },
            ],
      ),
    );
    return new AdminStatsService({ $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService);
  }

  it('기간 합계·앞 기간·일별을 나눠 셈', async () => {
    const result = await setup().overview(range);
    expect(result.bucket).toBe('day');
    expect(result.totals).toEqual({ signups: 4, newRevenueCents: 25800 });
    expect(result.previous).toEqual({ signups: 2, newRevenueCents: 12900 });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]).toEqual({ day: days[0], signups: 4, newRevenueCents: 0 });
    expect(result.daily[6]).toMatchObject({ newRevenueCents: 25800 });
  });

  it('3개월보다 길면 7일씩 묶음', () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({ day: `d${i}`, signups: 1, newRevenueCents: 100 }));
    const weeks = bucketOverviewWeekly(daily);
    expect(weeks.map((w) => w.day)).toEqual(['d0', 'd7']);
    expect(weeks[0]).toEqual({ day: 'd0', signups: 7, newRevenueCents: 700 });
    expect(weeks[1]).toEqual({ day: 'd7', signups: 3, newRevenueCents: 300 });
  });
});
