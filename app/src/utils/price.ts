import { getLocales } from 'expo-localization';

/**
 * 구독료 표시 — 2026-10-12 실기기 테스트("한국에서 하면 원, 일본이면 엔으로 나와야지"):
 * - 실제 결제 화면(스토어 상품이 있는 앱)은 스토어가 그 나라 통화로 준 가격(displayPrice)을 그대로 씀 — 실제 청구 금액과 같아야 해서.
 *   그건 화면에서 `useStorePurchase(...).displayPrice`로 받고, 여기서는 그게 없을 때(웹·테스트 구독·목록 화면)를 맡는다.
 * - 운영자가 입력하는 기준 가격은 바트(THB, `monthlyPriceCents`). 기기 지역(국가) 통화가 바트가 아니면 아래 참고 환율로 바꿔
 *   "≈ ₩4,100"처럼 대략 표시(스토어 가격과 정확히 같지 않을 수 있어서 ≈). 지원 안 하는 지역은 달러.
 * - 환율은 잠정 고정값(STATUS "출시 전 확정할 정책" — 표시 통화). 스토어 가격표를 정하면 그 가격에 맞춰 고칠 것.
 */

/** 1바트 = 몇 (통화) — 2026-10 참고값 */
const THB_RATE: Record<string, number> = {
  THB: 1,
  KRW: 41,
  JPY: 4.5,
  USD: 0.03,
  TWD: 0.97,
  HKD: 0.23,
  CNY: 0.22,
  VND: 780,
  SGD: 0.039,
  MYR: 0.13,
  PHP: 1.75, // 2026-10-22 추가 — 필리핀은 집중 시장인데 달러로 보였음
  IDR: 490,
};

const REGION_CURRENCY: Record<string, string> = {
  TH: 'THB',
  KR: 'KRW',
  JP: 'JPY',
  US: 'USD',
  TW: 'TWD',
  HK: 'HKD',
  MO: 'HKD',
  CN: 'CNY',
  VN: 'VND',
  SG: 'SGD',
  MY: 'MYR',
  PH: 'PHP',
  ID: 'IDR',
};

// 웹에서 브라우저 언어가 지역 없이 "ko"처럼만 오면 언어로 짐작
const LANGUAGE_REGION: Record<string, string> = { ko: 'KR', ja: 'JP', th: 'TH', vi: 'VN', zh: 'CN', en: 'US', fil: 'PH', tl: 'PH', id: 'ID' };

/** 반올림 단위 — 원은 100원, 엔은 10엔, 동·루피아는 1,000 단위로(나머지는 통화 기본 소수 자리) */
const ROUND_STEP: Record<string, number> = { KRW: 100, JPY: 10, VND: 1000, IDR: 1000, TWD: 1, THB: 1, PHP: 1 };

/** 기기 지역의 통화(지원 목록에 없으면 USD). 테스트에서 바꿀 수 있게 인자로 locale을 받음 */
export function displayCurrency(locale = getLocales()[0]): string {
  if (locale?.currencyCode && THB_RATE[locale.currencyCode]) return locale.currencyCode;
  const region = locale?.regionCode ?? LANGUAGE_REGION[locale?.languageCode ?? ''] ?? '';
  return REGION_CURRENCY[region] ?? 'USD';
}

function numberLocale(): string {
  return getLocales()[0]?.languageTag ?? 'en-US';
}

/** 바트 기준 금액(센트)을 기기 지역 통화로 — 바트가 아니면 "≈ " 붙임 */
export function formatPrice(thbCents: number, currency = displayCurrency(), locale = numberLocale()): string {
  const thb = thbCents / 100;
  const rate = THB_RATE[currency] ?? THB_RATE.USD;
  const target = THB_RATE[currency] ? currency : 'USD';
  const step = ROUND_STEP[target];
  const raw = thb * rate;
  const amount = step ? Math.max(step, Math.round(raw / step) * step) : Math.round(raw * 100) / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: target,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: step ? 0 : 2,
    minimumFractionDigits: step ? 0 : 2,
  }).format(amount);
  return target === 'THB' ? formatted : `≈ ${formatted}`;
}
