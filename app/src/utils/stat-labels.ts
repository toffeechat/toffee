import type { TFunction } from 'i18next';

import { isSupportedLanguage, LANGUAGE_NATIVE_NAMES } from '@/i18n/languages';

/** 나라 코드 → 이름. 자주 나오는 나라는 번역 파일(countries.*), 그 밖은 기기 Intl, 그것도 없으면 코드 그대로 */
export function countryLabel(code: string, t: TFunction, language: string): string {
  if (code === 'other') return t('dashboard.other');
  if (code === 'unknown') return t('dashboard.unknown');
  const key = `countries.${code}`;
  const translated = t(key);
  if (translated !== key) return translated;
  try {
    const DisplayNames = (Intl as { DisplayNames?: new (locales: string[], options: { type: 'region' }) => { of: (code: string) => string | undefined } })
      .DisplayNames;
    if (DisplayNames) return new DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    // 기기 Intl이 모르는 코드 — 아래에서 코드 그대로
  }
  return code;
}

/** 앱 언어 설정 → 이름(그 언어 자신의 표기). 저장된 언어가 없으면 "기기 언어" */
export function languageLabel(key: string, t: TFunction): string {
  if (key === 'other') return t('dashboard.other');
  if (key === 'unknown') return t('dashboard.deviceLanguage');
  return isSupportedLanguage(key) ? LANGUAGE_NATIVE_NAMES[key] : key;
}

/** YYYY-MM-DD → "10/13" 같은 짧은 날짜(앱 언어 순서) */
export function shortDay(day: string, language: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(language, { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
}
