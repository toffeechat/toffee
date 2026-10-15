import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { ThemedText } from '@/components/themed-text';

/**
 * 맨 아래 작은 버전 줄(2026-10-15) — "버전 1.0.0 · 업데이트 10. 15. 12:40". OTA가 실제로 들어왔는지 확인하려고(실기기에서 "수정이 안 보인다"는 게
 * 업데이트를 아직 못 받은 건지 바로 알 수 있게). 설치한 빌드 그대로면 "기본"으로, 웹·개발 빌드는 버전만
 */
export function AppVersion() {
  const { t, i18n } = useTranslation();
  const version = Constants.expoConfig?.version ?? '-';
  let update = '';
  if (Updates.isEnabled) {
    update = Updates.isEmbeddedLaunch || !Updates.createdAt
      ? t('appVersion.embedded')
      : t('appVersion.update', { date: Updates.createdAt.toLocaleString(i18n.language, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
  }
  return (
    <ThemedText type="caption" themeColor="textTertiary" style={styles.text}>
      {t('appVersion.version', { version })}
      {update ? ` · ${update}` : ''}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'center' },
});
