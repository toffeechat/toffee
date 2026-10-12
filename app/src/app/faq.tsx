import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CloudOff } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ExpandableItem } from '@/components/expandable-item';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useFaq } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 자주 묻는 질문(2026-10-12) — 본문은 서버(backend/src/legal/faq-texts.ts)가 원본, 공개 웹페이지 /faq와 같은 글 */
export default function FaqScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useFaq();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        {isError ? (
          <EmptyState icon={CloudOff} title={t('legal.loadFailed')} action={<Button title={t('discover.retry')} variant="secondary" onPress={() => void refetch()} />} />
        ) : null}
        {data?.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText type="captionBold" themeColor="textTertiary">
              {section.title}
            </ThemedText>
            {section.items.map((item) => (
              <ExpandableItem key={item.q} title={item.q} body={item.a} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  section: { gap: Spacing.two },
});
