/**
 * 장기 구독 혜택(2026-10-29 사용자 결정) — 끊기지 않고 이어서 구독한 기간(Subscription.streakStartedAt)에 따라
 * 답장 1개당 글자 수가 늘고, 1년 이상이면 아티스트·소속사 답장 화면에 "1년+" 배지. 버블(구독일 = 글자 수, 일 단위 10단계)과
 * 다르게 달 단위 5단계·처음부터 넉넉하게. 숫자는 운영하며 바꿀 수 있게 여기 한 곳에만 둠 — 앱(app/src/utils/reply-length.ts)도 같은 표.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// 이어서 구독한 날수(지난 날 기준) → 답장 1개당 최대 글자 수. 3개월 = 90일, 6개월 = 180일, 1년 = 365일, 2년 = 730일
export const REPLY_LENGTH_TIERS: readonly { days: number; max: number }[] = [
  { days: 0, max: 100 },
  { days: 90, max: 150 },
  { days: 180, max: 200 },
  { days: 365, max: 300 },
  { days: 730, max: 500 },
];

// "1년+" 배지 — 1년 이상만, 한 단계(사용자 결정)
export const YEAR_BADGE_DAYS = 365;

// 만료·해지 후 이 시간 안에 같은 방을 다시 구독하면 이어서 셈(버블과 같은 24시간). SUBSCRIPTION_STREAK_GRACE_HOURS로 조정
export const DEFAULT_STREAK_GRACE_HOURS = 24;

/** 구독을 시작한 지 꽉 찬 날수(시작한 날 = 0) */
export function streakElapsedDays(streakStartedAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - streakStartedAt.getTime()) / DAY_MS));
}

export function replyMaxLength(streakStartedAt: Date, now = new Date()): number {
  const days = streakElapsedDays(streakStartedAt, now);
  return REPLY_LENGTH_TIERS.reduce((max, tier) => (days >= tier.days ? tier.max : max), REPLY_LENGTH_TIERS[0].max);
}

/** 다음 단계(더 늘어날 날짜·글자 수) — 마지막 단계면 null. 앱 입력창 안내용 */
export function nextReplyTier(streakStartedAt: Date, now = new Date()): { at: Date; max: number } | null {
  const days = streakElapsedDays(streakStartedAt, now);
  const next = REPLY_LENGTH_TIERS.find((tier) => tier.days > days);
  return next ? { at: new Date(streakStartedAt.getTime() + next.days * DAY_MS), max: next.max } : null;
}

export function hasYearBadge(streakStartedAt: Date, now = new Date()): boolean {
  return streakElapsedDays(streakStartedAt, now) >= YEAR_BADGE_DAYS;
}

// 화면에 따로 보이지 않는 문자 — 결합 기호(태국어 모음·성조 부호 등), 폭 없는 문자(U+200B~200D·2060), 이모지 변형(FE00~FE0F)·
// 피부색(1F3FB~1F3FF)·태그(E0020~E007F). 앱 app/src/utils/reply-length.ts와 같은 규칙
const COMBINING_MARK = /\p{M}/u;
function notACharacter(char: string): boolean {
  const cp = char.codePointAt(0)!;
  return (
    COMBINING_MARK.test(char) ||
    (cp >= 0x200b && cp <= 0x200d) ||
    cp === 0x2060 ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
    (cp >= 0xe0020 && cp <= 0xe007f)
  );
}

/**
 * 답장 글자 수 — 보이는 글자 하나를 1자로(태국어는 모음·성조 기호가 따로 세져서 같은 말도 길게 나오던 것, 이모지도 1자).
 * 앱 입력창의 "12/100"도 같은 방법으로 셈(app/src/utils/reply-length.ts) — 둘이 다르면 앱은 된다는데 서버가 거절함
 */
export function countReplyChars(text: string): number {
  let count = 0;
  for (const char of text) if (!notACharacter(char)) count += 1;
  return count;
}
