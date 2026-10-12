import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { useAgencyDashboard, type DashboardRow } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

type SortKey = 'subscribers' | 'idle' | 'newSubs' | 'replies' | 'messages';

// 순위 기준 — "오래 안 보낸 순"은 한 번도 안 보낸 방이 맨 위
const SORTERS: Record<SortKey, (a: DashboardRow, b: DashboardRow) => number> = {
  subscribers: (a, b) => b.subscriberCount - a.subscriberCount,
  idle: (a, b) => (idleDays(b.lastBroadcastAt) ?? Number.MAX_SAFE_INTEGER) - (idleDays(a.lastBroadcastAt) ?? Number.MAX_SAFE_INTEGER),
  newSubs: (a, b) => b.newSubscriptions - a.newSubscriptions,
  replies: (a, b) => b.fanReplies - a.fanReplies,
  messages: (a, b) => b.messagesSent - a.messagesSent,
};
const SORT_KEYS: SortKey[] = ['subscribers', 'idle', 'newSubs', 'replies', 'messages'];

/**
 * 소속사 통계 대시보드(2026-10-12 사용자 결정으로 1차) — 아티스트별로 들어가지 않고 소속 아티스트 전체를 한눈에: 합계 + 기준별 순위
 * (구독자 많은 순, 메시지를 오래 안 보낸 순, 최근 30일 새 구독·팬 답장·보낸 메시지). 행을 누르면 그 아티스트 모니터링으로.
 */
export default function AgencyDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data, isLoading } = useAgencyDashboard();
  const [sort, setSort] = useState<SortKey>('subscribers');

  if (isLoading || !data) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  const rows = [...data.actors].sort(SORTERS[sort]);
  const sum = (pick: (row: DashboardRow) => number) => data.actors.reduce((total, row) => total + pick(row), 0);
  const totals = [
    { label: t('dashboard.subscribers'), value: sum((row) => row.subscriberCount) },
    { label: t('dashboard.newSubs', { days: data.days }), value: sum((row) => row.newSubscriptions) },
    { label: t('dashboard.cancellations', { days: data.days }), value: sum((row) => row.cancellations) },
    { label: t('dashboard.messages', { days: data.days }), value: sum((row) => row.messagesSent) },
    { label: t('dashboard.replies', { days: data.days }), value: sum((row) => row.fanReplies) },
  ];

  const metric = (row: DashboardRow) => {
    switch (sort) {
      case 'subscribers':
        return t('dashboard.countPeople', { count: row.subscriberCount });
      case 'idle': {
        const days = idleDays(row.lastBroadcastAt);
        return days === null ? t('console.noMessagesYet') : days === 0 ? t('console.lastMessageToday') : t('console.lastMessageDays', { count: days });
      }
      case 'newSubs':
        return t('dashboard.countPeople', { count: row.newSubscriptions });
      case 'replies':
        return t('dashboard.countItems', { count: row.fanReplies });
      case 'messages':
        return t('dashboard.countItems', { count: row.messagesSent });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.totals}>
              {totals.map((item) => (
                <View key={item.label} style={[styles.total, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="title">{item.value.toLocaleString()}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {item.label}
                  </ThemedText>
                </View>
              ))}
            </View>
            <View style={styles.chips}>
              {SORT_KEYS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setSort(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === key }}
                  style={[styles.chip, { backgroundColor: sort === key ? theme.tint : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={sort === key ? styles.chipActive : undefined}>
                    {t(`dashboard.sort.${key}`, { days: data.days })}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {t('console.empty')}
          </ThemedText>
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => router.push(`/console/${item.id}`)} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="headline" themeColor="textSecondary" style={styles.rank}>
              {index + 1}
            </ThemedText>
            <Avatar uri={item.chatProfileImageUrl} size={40} />
            <View style={styles.rowBody}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {item.chatDisplayName}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
                {t('dashboard.rowSummary', {
                  subscribers: item.subscriberCount,
                  newSubs: item.newSubscriptions,
                  replies: item.fanReplies,
                })}
              </ThemedText>
            </View>
            <ThemedText
              type="smallBold"
              themeColor={sort === 'idle' && (idleDays(item.lastBroadcastAt) ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS ? 'danger' : 'text'}
              style={styles.metric}>
              {metric(item)}
            </ThemedText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: Spacing.six },
  content: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth * 1.4, alignSelf: 'center' },
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  total: { flexGrow: 1, minWidth: 120, borderRadius: Radius.md, padding: Spacing.three, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  chipActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.md, padding: Spacing.three },
  rank: { width: 24, textAlign: 'center' },
  rowBody: { flex: 1, gap: 2 },
  metric: { flexShrink: 0 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
