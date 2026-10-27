import { describe, expect, it, vi } from 'vitest';
import { AdminStatsService, bucketOverviewWeekly } from './admin-stats.service.js';
import { rangeBounds, resolveRange } from '../actors/agency-stats.service.js';
import { DAY_MS, zoneDayStart, zoneDays } from '../common/utils/stats-time.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SMOKE_IDS } from '../smoke/smoke-ids.js';

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

describe('운영자 홈 오늘 숫자 → 목록(2026-10-25)', () => {
  const bounds = rangeBounds(resolveRange({ from: '2026-10-25', to: '2026-10-25' }, new Date('2026-10-25T10:00:00Z')));

  it('기간은 태국 날짜 0시 ~ 다음 날 0시', () => {
    expect(bounds.start.toISOString()).toBe('2026-10-24T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-10-25T17:00:00.000Z');
  });

  it('구독 시작·해지 목록은 고른 종류만 + 종류별 건수', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'e1' }]);
    const groupBy = vi.fn().mockResolvedValue([
      { type: 'STARTED', _count: { _all: 3 } },
      { type: 'CANCELLED', _count: { _all: 1 } },
    ]);
    const service = new AdminStatsService({ subscriptionEvent: { findMany, groupBy } } as unknown as PrismaService);
    const result = await service.subscriptionEvents(bounds, 'CANCELLED');
    expect(findMany.mock.calls[0][0].where).toEqual({ type: 'CANCELLED', createdAt: { gte: bounds.start, lt: bounds.end }, actorId: { not: SMOKE_IDS.actor } });
    expect(result.counts).toEqual({ STARTED: 3, CANCELLED: 1 });
    expect(result.items).toEqual([{ id: 'e1' }]);
  });

  it('방별 메시지 수는 아티스트 메시지 많은 순 + 합계', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { actorId: 'a', senderType: 'FAN', _count: { _all: 5 } },
      { actorId: 'b', senderType: 'ARTIST', _count: { _all: 2 } },
      { actorId: 'a', senderType: 'ARTIST', _count: { _all: 1 } },
    ]);
    const service = new AdminStatsService({ message: { groupBy } } as unknown as PrismaService);
    const result = await service.messageRooms(bounds);
    expect(result.rooms).toEqual([
      { actorId: 'b', messages: 2, fanReplies: 0 },
      { actorId: 'a', messages: 1, fanReplies: 5 },
    ]);
    expect(result.totals).toEqual({ messages: 3, fanReplies: 5 });
  });
});

describe('스모크 점검 계정·방은 운영자 통계에서 뺌(2026-10-27)', () => {
  it('오늘 숫자의 팬·구독·메시지 집계가 스모크 팬·방을 거름', async () => {
    const userCount = vi.fn().mockResolvedValue(0);
    const subCount = vi.fn().mockResolvedValue(0);
    const eventCount = vi.fn().mockResolvedValue(0);
    const messageCount = vi.fn().mockResolvedValue(0);
    const service = new AdminStatsService({
      user: { count: userCount },
      subscription: { count: subCount },
      subscriptionEvent: { count: eventCount },
      report: { count: vi.fn().mockResolvedValue(0) },
      message: { count: messageCount },
    } as unknown as PrismaService);
    await service.summary();
    for (const call of userCount.mock.calls) expect(call[0].where.id).toEqual({ not: SMOKE_IDS.fanUser });
    expect(subCount.mock.calls[0][0].where).toMatchObject({ user: { id: { not: SMOKE_IDS.fanUser } }, actorId: { not: SMOKE_IDS.actor } });
    for (const call of [...eventCount.mock.calls, ...messageCount.mock.calls]) expect(call[0].where.actorId).toEqual({ not: SMOKE_IDS.actor });
  });

  it('기간 추이(raw SQL)도 스모크 팬·방을 뺌', async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([]);
    await new AdminStatsService({ $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaService).overview(resolveRange({ days: 7 }));
    expect(queryRawUnsafe.mock.calls[0]).toContain(SMOKE_IDS.fanUser);
    expect(queryRawUnsafe.mock.calls[1]).toContain(SMOKE_IDS.actor);
  });
});
