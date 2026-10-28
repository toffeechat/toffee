import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CloudOff, Megaphone } from 'lucide-react-native';

import { ExpandableItem } from '@/components/expandable-item';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useMarkNoticesSeen, useNotices, useTranslateNotice } from '@/hooks/use-support';
import { ThemedText } from '@/components/themed-text';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 공지사항(2026-10-12) — 운영자가 쓴 점검·약관 변경·서비스 종료 안내. 고정 공지가 맨 위 */
export default function NoticesScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useNotices();
  useMarkNoticesSeen(data);
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
            // 공지는 한국어로 씀(2026-10-20 사용자 결정) — 한국어가 아닌 사람에게만 [번역 보기]
            footer={i18n.language === 'ko' ? undefined : <NoticeTranslation id={notice.id} />}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoticeTranslation({ id }: { id: string }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const translate = useTranslateNotice(id);
  const [shown, setShown] = useState(false);
  const onPress = () => {
    if (shown) return setShown(false);
    setShown(true);
    if (!translate.data || translate.data.language !== i18n.language) translate.mutate(i18n.language);
  };
  return (
    <View style={styles.translation}>
      {shown ? (
        translate.isPending ? (
          <ActivityIndicator style={styles.start} color={theme.textTertiary} />
        ) : translate.isError ? (
          <ThemedText type="small" themeColor="danger">
            {translate.error instanceof ApiError ? translate.error.message : t('translate.failed')}
          </ThemedText>
        ) : translate.data ? (
          <View style={[styles.translated, { borderLeftColor: theme.tint }]}>
            <ThemedText type="smallBold">{translate.data.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {translate.data.body}
            </ThemedText>
          </View>
        ) : null
      ) : null}
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={styles.start}>
        <ThemedText type="smallBold" style={{ color: theme.tint }}>
          {shown ? t('translate.hide') : t('translate.show')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  translation: { gap: Spacing.two },
  translated: { borderLeftWidth: 2, paddingLeft: Spacing.two, gap: 2 },
  start: { alignSelf: 'flex-start' },
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
