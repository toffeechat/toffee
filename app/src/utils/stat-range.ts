/*
 * 소속사 통계 기간 선택(2026-10-13) — 날짜는 전부 태국 날짜 문자열(YYYY-MM-DD). 서버(resolveRange)와 같은 규칙:
 * 시작 ≤ 끝 ≤ 오늘, 양 끝 포함 최대 MAX_RANGE_DAYS일.
 */

export const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
// 태국은 서머타임 없이 UTC+7
const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

const toUtc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 지금 태국 날짜 */
export function thaiToday(now = Date.now()): string {
  return fromUtc(now + THAI_OFFSET_MS);
}

export function addDays(day: string, count: number): string {
  return fromUtc(toUtc(day) + count * DAY_MS);
}

/** 양 끝 포함 일수 */
export function spanDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

/** month: 1~12. 달력 칸(일요일부터) — 앞뒤 빈칸은 null */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(fromUtc(Date.UTC(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 시작일을 고른 뒤 끝으로 고를 수 있는 날인지(오늘까지, 시작부터 1년 안) */
export function selectable(day: string, today: string, start?: string | null): boolean {
  if (day > today) return false;
  if (start && day >= start && spanDays(start, day) > MAX_RANGE_DAYS) return false;
  return true;
}

/** 빠른 선택 — 이번 달(1일~오늘), 지난달(1일~말일), 최근 1년(오늘 포함 366일) */
export function presetRange(preset: 'thisMonth' | 'lastMonth' | 'lastYear', today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  if (preset === 'thisMonth') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === 'lastMonth') {
    const lastDay = fromUtc(Date.UTC(y, m - 1, 0));
    return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
  }
  return { from: addDays(today, -(MAX_RANGE_DAYS - 1)), to: today };
}
