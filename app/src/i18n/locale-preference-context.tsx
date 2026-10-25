import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { loadPreference, savePreference } from '@/lib/preference-storage';

import i18n from './index';
import { getDeviceLanguage, isSupportedLanguage, type SupportedLanguage } from './languages';

const OVERRIDE_KEY = 'toffee_locale_override';

/**
 * 웹 주소의 `?lang=th` 같은 언어 지정(2026-10-14) — 태국 소속사에 보내는 데모 링크를 회사 PC 브라우저가 영어여도
 * 태국어로 열리게. 지원 언어면 "직접 고른 언어"로 저장해서 다음에 주소만 쳐도 그 언어로 뜸. 앱(네이티브)엔 없음.
 */
function languageFromUrl(): SupportedLanguage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const lang = new URLSearchParams(window.location.search).get('lang');
    return lang && isSupportedLanguage(lang) ? lang : null;
  } catch {
    return null;
  }
}

interface LocalePreferenceValue {
  /** 지금 적용 중인 언어 — 직접 고른 값이 있으면 그 값, 없으면 기기 언어 */
  locale: SupportedLanguage;
  /** 사용자가 직접 고른 값. null이면 "기기 언어 따르기" */
  override: SupportedLanguage | null;
  setOverride: (next: SupportedLanguage | null) => void;
  /** 화면 언어를 강제로 고정(운영자 = 한국어). 직접 고른 언어·기기 언어보다 우선, 저장은 안 함 */
  setForcedLocale: (next: SupportedLanguage | null) => void;
}

const LocalePreferenceContext = createContext<LocalePreferenceValue | null>(null);

export function LocalePreferenceProvider({ children }: { children: ReactNode }) {
  // 링크의 언어가 있으면 처음부터 그 언어로(영어로 잠깐 그려졌다 바뀌지 않게) — 저장된 값보다 우선
  const [urlLanguage] = useState(languageFromUrl);
  const [override, setOverrideState] = useState<SupportedLanguage | null>(urlLanguage);

  useEffect(() => {
    if (urlLanguage) {
      void savePreference(OVERRIDE_KEY, urlLanguage);
      return;
    }
    void loadPreference(OVERRIDE_KEY).then((stored) => {
      if (stored && isSupportedLanguage(stored)) setOverrideState(stored);
    });
  }, [urlLanguage]);

  const [forced, setForcedLocale] = useState<SupportedLanguage | null>(null);
  const locale = forced ?? override ?? getDeviceLanguage();

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  const setOverride = useCallback((next: SupportedLanguage | null) => {
    setOverrideState(next);
    void savePreference(OVERRIDE_KEY, next);
  }, []);

  const value = useMemo(() => ({ locale, override, setOverride, setForcedLocale }), [locale, override, setOverride]);
  return <LocalePreferenceContext.Provider value={value}>{children}</LocalePreferenceContext.Provider>;
}

export function useLocalePreference(): LocalePreferenceValue {
  const value = useContext(LocalePreferenceContext);
  if (!value) throw new Error('useLocalePreference must be used within LocalePreferenceProvider');
  return value;
}
