import { describe, expect, it, vi } from 'vitest';
import { AgencyStatsService, bucketWeekly, groupSmall, resolveRange } from './agency-stats.service.js';
import { startOfTodayInZone, zoneDays, DAY_MS, zoneDayStart } from '../common/utils/stats-time.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ActorsService } from './actors.service.js';

describe('국가·언어 분포', () => {
  it('작은 묶음은 기타로, 값 없음은 unknown, 많은 순', () => {
    expect(
      groupSmall(
        [
          { key: 'KR', count: 6 },
          { key: 'TH', count: 40 },
          { key: 'VN', count: 1 },
          { key: 'JP', count: 4 },
          { key: null, count: 7 },
        ],
        5,
      ),
    ).toEqual([
      { key: 'TH', count: 40 },
      { key: 'unknown', count: 7 },
      { key: 'KR', count: 6 },
      { key: 'other', count: 5 },
    ]);
  });

  it('전부 작으면 기타 하나만', () => {
    expect(groupSmall([{ key: 'TH', count: 2 }], 5)).toEqual([{ key: 'other', count: 2 }]);
    expect(groupSmall([], 5)).toEqual([]);
  });
});

describe('소속사 대시보드 집계', () => {
  const days = zoneDays(new Date(startOfTodayInZone().getTime() - 6 * DAY_MS), 7);
  const before = zoneDays(new Date(startOfTodayInZone().getTime() - 13 * DAY_MS), 1)[0];

  function setup() {
    const queryRawUnsafe = vi.fn((sql: string, ..._params: unknown[]) => {
      if (sql.includes('"SubscriptionEvent"')) {
        return Promise.resolve([
          { actorId: 'a1', kind: 'STARTED', day: days[0], count: 3n },
          { actorId: 'a2', kind: 'STARTED', day: days[6], count: 2n },
          { actorId: 'a1', kind: 'CANCELLED', day: days[6], count: 1n },
          // 앞 기간 — 증감 비교에만
          { actorId: 'a1', kind: 'STARTED', day: before, count: 4n },
        ]);
      }
      if (sql.includes('"Message"')) {
        return Promise.resolve([
          { actorId: 'a1', kind: 'ARTIST', day: days[3], count: 5n },
          { actorId: 'a1', kind: 'FAN', day: days[3], count: 12n },
        ]);
      }
      // 나라·언어(구독 중인 팬)
      return Promise.resolve(sql.includes('countryCode') ? [{ key: 'TH', count: 9n }] : [{ key: 'th', count: 9n }]);
    });
    const prisma = {
      $queryRawUnsafe: queryRawUnsafe,
      subscription: { groupBy: vi.fn().mockResolvedValue([{ actorId: 'a1', _count: { _all: 7 } }, { actorId: 'a2', _count: { _all: 2 } }]) },
      // 지난 날짜의 하루 기록 — a1만 기록 있음
      actorDailyStat: {
        findMany: vi.fn().mockResolvedValue([{ actorId: 'a1', day: before, subscribers: 6, countries: { TH: 5, VN: 1 }, languages: { th: 6 } }]),
      },
    } as unknown as PrismaService;
    const actors = {
      findMine: vi.fn().mockResolvedValue([
        { id: 'a1', kind: 'SOLO', chatDisplayName: 'A', legalName: 'A', chatProfileImageUrl: null, retiredAt: null, lastBroadcastAt: null, agency: { id: 'g1' }, coupleMembers: [] },
        {
          id: 'a2',
          kind: 'COUPLE',
          chatDisplayName: 'B',
          legalName: 'B',
          chatProfileImageUrl: null,
          retiredAt: null,
          lastBroadcastAt: null,
          agency: null,
          coupleMembers: [{ member: { agency: { id: 'g2' } } }, { member: { agency: null } }],
        },
      ]),
    } as unknown as ActorsService;
    return { service: new AgencyStatsService(prisma, actors), queryRawUnsafe };
  }

  it('합계·앞 기간·일별·방별을 나눠 셈', async () => {
    const { service } = setup();
    const result = await service.dashboard('u1', resolveRange({ days: 7 }), 'ALL');
    expect(result.totals).toEqual({ subscribers: 9, newSubscriptions: 5, cancellations: 1, messagesSent: 5, fanReplies: 12 });
    expect(result.previous.newSubscriptions).toBe(4);
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]).toMatchObject({ day: days[0], newSubscriptions: 3 });
    expect(result.daily[6]).toMatchObject({ newSubscriptions: 2, cancellations: 1 });
    expect(result.actors.find((row) => row.id === 'a1')).toMatchObject({ subscriberCount: 7, newSubscriptions: 3, fanReplies: 12 });
    // 9명은 기준(5) 이상이라 그대로
    expect(result.countries).toEqual([{ key: 'TH', count: 9 }]);
    expect(result.fans).toBe(9);
  });

  it('지난 날짜로 끝나는 기간은 "구독 중"·분포를 그날 기록으로(방마다 더함)', async () => {
    const { service } = setup();
    const toStart = zoneDayStart(before)!;
    const from = zoneDays(new Date(toStart.getTime() - 6 * DAY_MS), 1)[0];
    const result = await service.dashboard('u1', { from, to: before, days: 7 }, 'ALL');
    expect(result.audienceAsOf).toBe(before);
    expect(result.distinctFans).toBe(false);
    expect(result.totals.subscribers).toBe(6);
    expect(result.actors.find((row) => row.id === 'a1')?.subscriberCount).toBe(6);
    // VN 1명은 5명 미만이라 기타
    expect(result.countries).toEqual([{ key: 'TH', count: 5 }, { key: 'other', count: 1 }]);
  });

  it('CP만 고르면 CP방 id로만 조회', async () => {
    const { service, queryRawUnsafe } = setup();
    const result = await service.dashboard('u1', resolveRange({ days: 7 }), 'COUPLE');
    expect(result.actors.map((row) => row.id)).toEqual(['a2']);
    expect(queryRawUnsafe.mock.calls[0][1]).toEqual(['a2']);
  });

  it('소속사 필터 — 개인방은 방 소속사, CP방은 멤버 소속사로', async () => {
    const { service } = setup();
    expect((await service.dashboard('u1', resolveRange({ days: 7 }), 'ALL', 'g1')).actors.map((row) => row.id)).toEqual(['a1']);
    expect((await service.dashboard('u1', resolveRange({ days: 7 }), 'ALL', 'g2')).actors.map((row) => row.id)).toEqual(['a2']);
    expect((await service.dashboard('u1', resolveRange({ days: 7 }), 'ALL', 'none')).actors).toEqual([]);
  });
});

describe('기간 고르기', () => {
  const now = new Date('2026-10-13T05:00:00Z'); // 태국 12시

  it('최근 N일은 오늘까지', () => {
    expect(resolveRange({ days: 7 }, now)).toEqual({ from: '2026-10-07', to: '2026-10-13', days: 7 });
    expect(resolveRange({}, now).days).toBe(30);
  });

  it('직접 고른 기간 — 양 끝 포함, 최대 1년, 오늘까지', () => {
    expect(resolveRange({ from: '2026-08-01', to: '2026-09-15' }, now)).toEqual({ from: '2026-08-01', to: '2026-09-15', days: 46 });
    expect(resolveRange({ from: '2025-10-13', to: '2026-10-13' }, now).days).toBe(366);
    expect(() => resolveRange({ from: '2025-10-12', to: '2026-10-13' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-09-15', to: '2026-08-01' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-10-01', to: '2026-10-14' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-02-30', to: '2026-03-01' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-10-01' }, now)).toThrow();
  });

  it('태국 날짜 0시', () => {
    expect(zoneDayStart('2026-10-13')?.toISOString()).toBe('2026-10-12T17:00:00.000Z');
    expect(zoneDayStart('2026-13-01')).toBeNull();
  });

  it('긴 기간은 7일씩 묶음(첫날 기준, 마지막은 짧을 수 있음)', () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({ day: `d${i}`, newSubscriptions: 1, cancellations: 0, messagesSent: i, fanReplies: 0 }));
    const weeks = bucketWeekly(daily);
    expect(weeks.map((w) => w.day)).toEqual(['d0', 'd7']);
    expect(weeks[0]).toMatchObject({ newSubscriptions: 7, messagesSent: 21 });
    expect(weeks[1]).toMatchObject({ newSubscriptions: 3, messagesSent: 24 });
  });
});
