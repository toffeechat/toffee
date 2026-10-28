/**
 * 가입 연령 기준 — 국가별(잠정, STATUS.md "출시 전 확정할 정책", 👤 변호사 확정). 가입 때 저장한 기기 지역(User.countryCode) 기준.
 * 목록에 없는 나라·국가를 모르는 경우는 가장 엄격한 값으로.
 */

/**
 * 성인만 가입(ADULTS_ONLY, 2026-09-29 사용자 결정 — 기본값)일 때: "만 N세 미만이면 가입 불가"의 N = 그 나라 성년 나이.
 * 한국 만 19세(민법), 태국 만 20세(민상법), 일본·대만·홍콩·말레이시아·중국 만 18세, 싱가포르 만 21세(계약 기준).
 * 필리핀 만 18세(가족법)·베트남 만 18세(민법) — 2026-10-28 점검: 출시 국가 필리핀이 빠져 있어 기본값 20세로 18~19세가 영구히 가입 불가였음(잠정, 변호사 확정).
 */
export const ADULT_AGE_BY_COUNTRY: Readonly<Record<string, number>> = {
  KR: 19,
  TH: 20,
  JP: 18,
  TW: 18,
  HK: 18,
  MO: 18,
  MY: 18,
  CN: 18,
  SG: 21,
  PH: 18,
  VN: 18,
};
export const DEFAULT_ADULT_AGE = 20;

export function adultAgeFor(countryCode: string | null | undefined): number {
  return (countryCode && ADULT_AGE_BY_COUNTRY[countryCode.toUpperCase()]) || DEFAULT_ADULT_AGE;
}

/**
 * 부모 동의 방식(ADULTS_ONLY=false로 되돌릴 때만 씀): "만 N세 미만이면 법정대리인 동의 필요"의 N.
 * 한국은 개인정보보호법 만 14세, 태국은 PDPA상 미성년(만 20세 미만)이라 20.
 */
export const CONSENT_AGE_BY_COUNTRY: Readonly<Record<string, number>> = {
  KR: 14,
  TH: 20,
};
export const DEFAULT_CONSENT_AGE = 20;

export function consentAgeFor(countryCode: string | null | undefined): number {
  return (countryCode && CONSENT_AGE_BY_COUNTRY[countryCode.toUpperCase()]) || DEFAULT_CONSENT_AGE;
}

/** 앱이 보낸 국가 코드 정리 — 두 글자 영문만 인정(그 외는 모름 처리) */
export function normalizeCountryCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * 나이 계산용 그 나라 시간(UTC와의 시차, 시간) — 생일 당일 새벽에 입력하면 UTC로는 아직 전날이라 한 살 어리게 판정됐음(2026-10-28 점검,
 * 태국 0~7시). 모르는 나라는 세계에서 가장 이른 시간대(+14)로 — 어딘가에서 생일이 시작됐으면 인정(한 번 입력하면 못 고쳐서 불리하게 막지 않게)
 */
const UTC_OFFSET_HOURS_BY_COUNTRY: Readonly<Record<string, number>> = {
  TH: 7,
  VN: 7,
  PH: 8,
  MY: 8,
  SG: 8,
  CN: 8,
  TW: 8,
  HK: 8,
  MO: 8,
  KR: 9,
  JP: 9,
};

/** 그 나라의 지금 날짜를 UTC 자정 기준 Date로(calculateAge의 now로 씀) */
export function localNowFor(countryCode: string | null | undefined, now = new Date()): Date {
  const offset = (countryCode ? UTC_OFFSET_HOURS_BY_COUNTRY[countryCode.toUpperCase()] : undefined) ?? 14;
  return new Date(now.getTime() + offset * 60 * 60 * 1000);
}
