import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

/** 역할별 첫 화면 — 로그인 직후·뒤로 갈 곳이 없을 때 */
export function homeFor(role: string | null | undefined): '/admin' | '/console' | '/studio' | '/' {
  return role === 'ADMIN' ? '/admin' : role === 'AGENCY_STAFF' ? '/console' : role === 'ACTOR' ? '/studio' : '/';
}

/**
 * 화면 위 뒤로가기(2026-10-14 사용자 피드백 "뒤로가기가 제대로 안 보임") — 기본 버튼 대신 우리 버튼으로 색을 글자색에 고정하고,
 * 웹에서 주소로 바로 열었거나 새로고침해서 돌아갈 기록이 없으면(예전엔 버튼이 아예 없어 갇힘) 역할별 첫 화면으로 보냄.
 */
export function HeaderBack({ canGoBack }: { canGoBack?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { role } = useAuth();
  const home = homeFor(role);
  if (!canGoBack && (Platform.OS !== 'web' || pathname === home)) return null;
  return (
    <IconButton
      icon={Platform.OS === 'ios' ? ChevronLeft : ArrowLeft}
      size={Platform.OS === 'ios' ? 28 : 24}
      label={t('actorProfile.back')}
      color={theme.text}
      onPress={() => (canGoBack ? router.back() : router.replace(home))}
    />
  );
}
