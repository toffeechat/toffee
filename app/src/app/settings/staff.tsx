import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, Globe, KeyRound, LogOut, Moon } from 'lucide-react-native';

import { ListRow } from '@/components/ui/list-row';
import { PROVIDER_NAMES } from '@/components/social-button-style';
import { useMe } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGE_NATIVE_NAMES } from '@/i18n/languages';
import { useLocalePreference } from '@/i18n/locale-preference-context';
import { useAuth } from '@/lib/auth-context';
import { useThemePreference } from '@/lib/theme-preference';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * 아티스트·소속사 설정(2026-10-12 — "알림 설정이 역할마다 없다") — 팬 마이페이지 대신. 알림(역할별), 화면 모드, 언어, 로그인 정보, 로그아웃.
 * 소속사 PC 웹은 왼쪽 메뉴 "설정", 폰은 콘솔 첫 화면·스튜디오 프로필에서 들어옴
 */
export default function StaffSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { data: me } = useMe();
  const { override } = useLocalePreference();
  const themePreference = useThemePreference();
  const providers = (me?.loginProviders ?? []).map((provider) => PROVIDER_NAMES[provider]).join(' · ');
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <ListRow icon={Bell} title={t('profile.notifications')} onPress={() => router.push('/settings/notifications')} />
      <ListRow icon={Moon} title={t('themeMode.title')} value={t(`themeMode.${themePreference}`)} onPress={() => router.push('/settings/theme')} />
      <ListRow
        icon={Globe}
        title={t('profile.language')}
        value={override ? LANGUAGE_NATIVE_NAMES[override] : t('profile.languageSystem')}
        onPress={() => router.push('/settings/language')}
      />
      <ListRow icon={KeyRound} title={t('profile.loginInfo')} value={providers || undefined} subtitle={me?.email ?? t('profile.noEmail')} showChevron={false} />
      <ListRow icon={LogOut} title={t('profile.logout')} onPress={() => void logout()} showChevron={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
