import { describe, expect, it } from 'vitest';
import { addDays, monthGrid, presetRange, selectable, spanDays, thaiToday } from './stat-range';

describe('통계 기간 선택', () => {
  it('태국 날짜 — 한국 시간 새벽에도 태국 날짜로', () => {
    // UTC 10-13 17:30 = 태국 10-14 00:30
    expect(thaiToday(Date.parse('2026-10-13T17:30:00Z'))).toBe('2026-10-14');
    expect(thaiToday(Date.parse('2026-10-13T16:59:00Z'))).toBe('2026-10-13');
  });

  it('날짜 계산', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(spanDays('2026-08-01', '2026-09-15')).toBe(46);
    expect(spanDays('2026-10-13', '2026-10-13')).toBe(1);
  });

  it('달력 칸 — 2026년 10월은 목요일 시작', () => {
    const grid = monthGrid(2026, 10);
    expect(grid.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(grid.length % 7).toBe(0);
  });

  it('고를 수 있는 날 — 오늘까지, 시작부터 1년 안', () => {
    expect(selectable('2026-10-14', '2026-10-13')).toBe(false);
    expect(selectable('2026-10-13', '2026-10-13', '2025-10-13')).toBe(true);
    expect(selectable('2026-10-13', '2026-10-13', '2025-10-12')).toBe(false);
  });

  it('빠른 선택', () => {
    expect(presetRange('thisMonth', '2026-10-13')).toEqual({ from: '2026-10-01', to: '2026-10-13' });
    expect(presetRange('lastMonth', '2026-01-13')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(spanDays(presetRange('lastYear', '2026-10-13').from, '2026-10-13')).toBe(366);
  });
});
