import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/** "문의하기" — 앱 안 1:1 문의(2026-10-20, 예전엔 메일 앱) */
export function SupportLink() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/support')}>
        <ThemedText type="small">{t('support.contact')}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2, backgroundColor: 'transparent' },
});
