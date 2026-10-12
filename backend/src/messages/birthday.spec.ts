import { describe, expect, it } from 'vitest';
import { birthdayToday, isBirthdayToday } from './birthday.js';

describe('생일 축하 날짜(태국 시간)', () => {
  it('태국 날짜 기준 — UTC 전날 밤 17시 이후면 이미 다음 날', () => {
    expect(birthdayToday(new Date('2026-10-29T17:30:00Z'))).toEqual({ year: 2026, month: 10, days: [30] });
    expect(birthdayToday(new Date('2026-10-29T16:59:00Z'))).toEqual({ year: 2026, month: 10, days: [29] });
  });

  it('2월 29일생은 평년엔 2월 28일에, 윤년엔 29일에', () => {
    const leapling = new Date('2000-02-29T00:00:00Z');
    expect(isBirthdayToday(leapling, birthdayToday(new Date('2027-02-28T03:00:00Z')))).toBe(true);
    expect(isBirthdayToday(leapling, birthdayToday(new Date('2028-02-28T03:00:00Z')))).toBe(false);
    expect(isBirthdayToday(leapling, birthdayToday(new Date('2028-02-29T03:00:00Z')))).toBe(true);
  });

  it('월·일만 비교', () => {
    expect(isBirthdayToday(new Date('1995-10-30T00:00:00Z'), birthdayToday(new Date('2026-10-30T02:00:00Z')))).toBe(true);
    expect(isBirthdayToday(new Date('1995-11-30T00:00:00Z'), birthdayToday(new Date('2026-10-30T02:00:00Z')))).toBe(false);
  });
});
