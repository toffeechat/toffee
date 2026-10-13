// 통계의 "하루"는 태국 시간 기준(주 시장) — 날짜 경계를 서버 시간대에 맡기지 않음. 운영자 통계·소속사 대시보드 공용
export const STATS_TIME_ZONE = 'Asia/Bangkok';
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 태국 시간 기준 오늘 0시(UTC Date) */
export function startOfTodayInZone(now = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  // Asia/Bangkok은 서머타임 없이 UTC+7 고정
  return new Date(Date.UTC(y, m - 1, d) - 7 * 60 * 60 * 1000);
}

/** SQL에서 timestamp 열을 태국 날짜 문자열(YYYY-MM-DD)로 */
export function zoneDayExpr(column: string): string {
  return `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${STATS_TIME_ZONE}', 'YYYY-MM-DD')`;
}

/** from(태국 0시)부터 days일의 날짜 문자열 목록 */
export function zoneDays(from: Date, days: number): string[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIME_ZONE });
  return Array.from({ length: days }, (_, i) => format.format(new Date(from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000)));
}
