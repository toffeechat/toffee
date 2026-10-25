import { useEffect } from 'react';

import { useLocalePreference } from '@/i18n/locale-preference-context';
import { useAuth } from '@/lib/auth-context';

/**
 * 운영자(ADMIN) 계정은 화면 언어를 한국어로 고정(2026-10-25). 운영자 화면은 한국어만 두기로 했지만 홈 대시보드·날짜·
 * 공용 부품(토피룸 모니터링 등)이 소속사 화면과 같은 번역 문구를 앱 언어로 써서, 태국 소속사용 `?lang=th` 데모 링크를
 * 연 브라우저나 태국어 기기에선 운영자 화면 일부가 태국어로 나왔음. 로그아웃하거나 다른 역할이면 원래 언어로 돌아감.
 */
export function useAdminKorean(): void {
  const { role } = useAuth();
  const { setForcedLocale } = useLocalePreference();
  useEffect(() => {
    setForcedLocale(role === 'ADMIN' ? 'ko' : null);
  }, [role, setForcedLocale]);
}
