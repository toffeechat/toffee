import { fullMonthsBetween, summarize } from './partner-subscriptions.js';

describe('검볼 선예매용 구독 요약', () => {
  it('꽉 찬 개월 수 — 기념일 전이면 한 달 덜', () => {
    expect(fullMonthsBetween(new Date('2026-01-15T00:00:00Z'), new Date('2026-04-14T23:00:00Z'))).toBe(2);
    expect(fullMonthsBetween(new Date('2026-01-15T00:00:00Z'), new Date('2026-04-15T00:00:00Z'))).toBe(3);
    // 1/31 시작 → 2/28엔 아직 1개월이 안 참, 3/31에 2개월
    expect(fullMonthsBetween(new Date('2026-01-31T00:00:00Z'), new Date('2026-02-28T12:00:00Z'))).toBe(0);
    expect(fullMonthsBetween(new Date('2026-01-31T00:00:00Z'), new Date('2026-03-31T00:00:00Z'))).toBe(2);
    expect(fullMonthsBetween(new Date('2026-05-01T00:00:00Z'), new Date('2026-04-01T00:00:00Z'))).toBe(0);
  });

  it('개인방·커플방 중 가장 오래 이어진 방 기준, 방 목록·시작 시각', () => {
    const now = new Date('2026-10-28T00:00:00Z');
    const s = summarize(
      [
        { actorId: 'solo', startedAt: new Date('2026-08-01T00:00:00Z') },
        { actorId: 'couple', startedAt: new Date('2026-03-10T00:00:00Z') },
      ],
      now,
    );
    expect(s).toEqual({ active: true, continuousMonths: 7, roomIds: ['solo', 'couple'], since: '2026-03-10T00:00:00.000Z' });
    expect(summarize([], now)).toEqual({ active: false, continuousMonths: 0, roomIds: [], since: null });
  });
});
