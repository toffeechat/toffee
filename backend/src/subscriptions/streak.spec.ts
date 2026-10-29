import { describe, expect, it } from 'vitest';
import { countReplyChars, hasYearBadge, nextReplyTier, replyMaxLength, streakElapsedDays } from './streak.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2027-06-01T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);

describe('장기 구독 혜택(2026-10-29)', () => {
  it('답장 글자 수 — 처음 100 → 3개월 150 → 6개월 200 → 1년 300 → 2년 500', () => {
    expect([0, 89, 90, 179, 180, 364, 365, 729, 730, 2000].map((d) => replyMaxLength(ago(d), now))).toEqual([
      100, 100, 150, 150, 200, 200, 300, 300, 500, 500,
    ]);
  });

  it('"1년+" 배지는 365일부터', () => {
    expect(hasYearBadge(ago(364), now)).toBe(false);
    expect(hasYearBadge(ago(365), now)).toBe(true);
  });

  it('다음 단계 날짜·글자 수, 마지막 단계면 null', () => {
    expect(nextReplyTier(ago(10), now)).toEqual({ at: new Date(ago(10).getTime() + 90 * DAY), max: 150 });
    expect(nextReplyTier(ago(800), now)).toBeNull();
  });

  it('시작 시각이 미래여도(시계 차이) 0일', () => {
    expect(streakElapsedDays(new Date(now.getTime() + DAY), now)).toBe(0);
  });

  it('보이는 글자 기준으로 셈 — 태국어 결합 기호·이모지 변형·피부색은 따로 안 셈', () => {
    expect(countReplyChars('สวัสดีค่ะ')).toBe(6);
    expect(countReplyChars('안녕하세요')).toBe(5);
    expect(countReplyChars('hi ❤️')).toBe(4);
    expect(countReplyChars('👍🏽')).toBe(1);
    expect(countReplyChars('')).toBe(0);
  });
});
