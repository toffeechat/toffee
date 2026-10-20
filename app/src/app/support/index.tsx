import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useMyInquiries } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { SUPPORT_EMAIL } from '@/lib/env';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/** 1:1 문의 목록(2026-10-20) — 마이페이지·스튜디오·소속사 설정의 "문의하기". 운영자가 답하면 푸시 */
export default function SupportListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useMyInquiries();
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Button title={t('inquiry.new')} icon={MessageSquarePlus} onPress={() => router.push('/support/new')} />
          {SUPPORT_EMAIL ? (
            <ThemedText type="caption" themeColor="textTertiary" style={styles.center} selectable>
              {t('inquiry.emailInstead', { email: SUPPORT_EMAIL })}
            </ThemedText>
          ) : null}
          {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        </View>
      }
      ListEmptyComponent={isLoading ? null : <EmptyState icon={MessageSquarePlus} title={t('inquiry.empty')} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/support/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.rowTop}>
            <ThemedText type="caption" themeColor="textTertiary">
              {t(`inquiry.cat_${item.category}`)}
            </ThemedText>
            <ThemedText type="captionBold" style={{ color: item.status === 'ANSWERED' ? theme.tint : theme.textTertiary }}>
              {t(`inquiry.st_${item.status}`)}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            {new Date(item.updatedAt).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </ThemedText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  center: { textAlign: 'center' },
  row: { borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
});
