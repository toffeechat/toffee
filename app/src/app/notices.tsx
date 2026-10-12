import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CloudOff, Megaphone } from 'lucide-react-native';

import { ExpandableItem } from '@/components/expandable-item';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotices } from '@/hooks/use-support';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 공지사항(2026-10-12) — 운영자가 쓴 점검·약관 변경·서비스 종료 안내. 고정 공지가 맨 위 */
export default function NoticesScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useNotices();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        {isError ? (
          <EmptyState icon={CloudOff} title={t('legal.loadFailed')} action={<Button title={t('discover.retry')} variant="secondary" onPress={() => void refetch()} />} />
        ) : null}
        {data && data.length === 0 ? <EmptyState icon={Megaphone} title={t('notices.empty')} /> : null}
        {data?.map((notice) => (
          <ExpandableItem
            key={notice.id}
            title={`${notice.pinned ? '📌 ' : ''}${notice.title}`}
            caption={new Date(notice.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
            body={notice.body}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
