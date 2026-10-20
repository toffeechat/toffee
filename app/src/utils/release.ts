// 공개 예정·예약 오픈(2026-10-19) — 서버의 releaseAt(아티스트·CP방)·opensAt(묶음)이 미래면 "곧 공개". 시각은 팬 휴대폰 시간대로 보여 줌
// (운영자는 태국 시간으로 입력, 팬은 5개 나라라서)

export function isUpcoming(releaseAt: string | null | undefined, now = Date.now()): boolean {
  return !!releaseAt && new Date(releaseAt).getTime() > now;
}

/** "11월 1일 오후 8:00"처럼 — 사진 카드·프로필의 "곧 공개" 줄 */
export function formatReleaseAt(releaseAt: string, locale: string): string {
  return new Date(releaseAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** 태국 시간(UTC+7, 서머타임 없음) 입력 "2026-11-01 20:00" ↔ ISO — 운영자 화면 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function parseBangkokDateTime(input: string): string | null {
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{2})\s*$/.exec(input);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute) - BANGKOK_OFFSET_MS;
  const check = new Date(utc + BANGKOK_OFFSET_MS);
  // 2월 30일 같은 없는 날짜 거름
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1) return null;
  return new Date(utc).toISOString();
}

export function formatBangkokDateTime(iso: string): string {
  const date = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
