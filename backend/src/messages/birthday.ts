/**
 * 생일 축하 메시지 날짜 계산(2026-10-12) — 태국 시간 기준 "오늘"(다른 예약 작업과 같음). 생년월일은 날짜만 의미가 있어서
 * UTC 자정으로 저장된 값의 월·일을 그대로 씀. 2월 29일생은 윤년이 아니면 2월 28일에 축하.
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface BirthdayToday {
  year: number;
  month: number; // 1~12
  /** 오늘 축하할 생일(일). 평년 2월 28일이면 [28, 29] */
  days: number[];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function birthdayToday(now: Date): BirthdayToday {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  return { year, month, days: month === 2 && day === 28 && !isLeapYear(year) ? [28, 29] : [day] };
}

export function isBirthdayToday(birthDate: Date, today: BirthdayToday): boolean {
  return birthDate.getUTCMonth() + 1 === today.month && today.days.includes(birthDate.getUTCDate());
}
