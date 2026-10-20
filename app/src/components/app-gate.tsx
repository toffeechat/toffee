import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Download, Wrench } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useAppConfig } from '@/hooks/use-app-config';
import { onMaintenance } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { compareVersions } from '@/utils/version';

/** 스토어 앱 화면 — iOS는 앱 ID(EXPO_PUBLIC_IOS_APP_STORE_ID)가 있어야 바로 감, 없으면 검색 */
function openStorePage() {
  if (Platform.OS === 'android') {
    const pkg = Constants.expoConfig?.android?.package ?? '';
    return Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`);
  }
  const id = process.env.EXPO_PUBLIC_IOS_APP_STORE_ID;
  return Linking.openURL(id ? `https://apps.apple.com/app/id${id}` : 'https://apps.apple.com/search?term=toffee');
}

/**
 * 앱 전체 문(2026-10-20) — 점검 모드면 운영자 말고는 점검 화면(로그인 전이면 [운영자 로그인]으로 로그인 화면은 열 수 있음), 설치된 앱 버전이
 * 최소 버전보다 낮으면(앱만, 웹은 늘 최신) 업데이트 화면. 서버가 503 MAINTENANCE를 주면 설정을 바로 다시 받음.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { role, token } = useAuth();
  const queryClient = useQueryClient();
  const { data, refetch, isFetching } = useAppConfig();
  const [staffLogin, setStaffLogin] = useState(false);

  useEffect(() => {
    onMaintenance(() => void queryClient.invalidateQueries({ queryKey: ['app-config'] }));
    return () => onMaintenance(null);
  }, [queryClient]);

  const version = Constants.expoConfig?.version;
  const minVersion = Platform.OS === 'ios' ? data?.minVersion.ios : Platform.OS === 'android' ? data?.minVersion.android : null;
  if (minVersion && version && compareVersions(version, minVersion) < 0) {
    return (
      <Screen icon={Download} title={t('appGate.updateTitle')} body={t('appGate.updateBody')}>
        <Button title={t('appGate.updateButton')} onPress={() => void openStorePage()} />
      </Screen>
    );
  }

  const maintenance = data?.maintenance.on && role !== 'ADMIN' && !(staffLogin && !token);
  if (!maintenance) return <>{children}</>;
  return (
    <Screen icon={Wrench} title={t('appGate.maintenanceTitle')} body={t('appGate.maintenanceBody')}>
      {data?.maintenance.message ? (
        <ThemedText type="small" style={[styles.message, { backgroundColor: theme.backgroundElement }]}>
          {data.maintenance.message}
        </ThemedText>
      ) : null}
      {data?.maintenance.until ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('appGate.maintenanceUntil', { date: new Date(data.maintenance.until).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}
        </ThemedText>
      ) : null}
      <Button title={t('appGate.retry')} variant="secondary" loading={isFetching} onPress={() => void refetch()} />
      {!token ? <Button title={t('appGate.staffLogin')} variant="ghost" onPress={() => setStaffLogin(true)} /> : null}
    </Screen>
  );
}

function Screen({ icon, title, body, children }: { icon: typeof Wrench; title: string; body: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.tintSoft }]}>
        <Icon as={icon} size={32} color={theme.tint} />
      </View>
      <ThemedText type="title" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {body}
      </ThemedText>
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three },
  iconBox: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center', maxWidth: 420 },
  message: { padding: Spacing.three, borderRadius: 12, maxWidth: 420, textAlign: 'center' },
  actions: { width: '100%', maxWidth: 320, gap: Spacing.two, alignItems: 'stretch' },
});
