import { useEffect, useState } from 'react';

import { loadPreference, savePreference } from '@/lib/preference-storage';
import type { SocialProvider } from '@/lib/social-types';

/**
 * 최근 로그인(2026-10-12 사용자 요청) — 이 기기에서 마지막으로 성공한 소셜 로그인을 기억해 두고 로그인 화면 그 버튼에 "최근 로그인" 표시.
 * 기기에만 저장(서버에 안 보냄) — 로그아웃해도 남아서 다음에 같은 버튼을 바로 찾게.
 */
const KEY = 'toffee_last_login_provider';
const PROVIDERS: SocialProvider[] = ['apple', 'google', 'line', 'kakao', 'naver'];

export function saveLastLoginProvider(provider: SocialProvider): void {
  void savePreference(KEY, provider).catch(() => {});
}

export function useLastLoginProvider(): SocialProvider | null {
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadPreference(KEY)
      .then((stored) => {
        if (!cancelled && stored && (PROVIDERS as string[]).includes(stored)) setProvider(stored as SocialProvider);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return provider;
}
