import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AdminChip, formatBaht } from '@/components/admin-ui';
import { StatsRangeControl, selectionLabel } from '@/components/stats-range-picker';
import { useWideLayout } from '@/components/wide-shell';
import { useAdminSubscriptionEvents, type AdminSubscriptionEvent } from '@/hooks/use-admin';
import { selectionFromParams, type StatsSelection } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { thaiToday } from '@/utils/stat-range';

type EventType = AdminSubscriptionEvent['type'];
const TYPES: { value: EventType; label: string }[] = [
  { value: 'STARTED', label: '구독 시작' },
  { value: 'CANCELLED', label: '해지' },
];

const fanName = (event: AdminSubscriptionEvent) =>
  event.user.deletedAt ? '탈퇴한 회원' : (event.user.nickname ?? event.user.displayName);
const roomName = (event: AdminSubscriptionEvent) =>
  event.actor.kind === 'COUPLE' ? event.actor.chatDisplayName : `${event.actor.chatDisplayName}(${event.actor.legalName})`;
const timeText = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Bangkok', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * 구독 시작·해지 목록(2026-10-25 사용자 요청: 운영자 홈 "오늘 구독 시작 N · 해지 M"을 누르면 그날 목록) — 누가 어느 방을 언제(태국 시간) 시작·해지했는지,
 * 시작은 적용 가격(할인 반영). 기간은 통계와 같은 고르기. 줄을 누르면 회원 상세(구독·결제 내역).
 */
export default function AdminSubscriptionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const wide = useWideLayout();
  const { i18n } = useTranslation();
  const params = useLocalSearchParams<{ type?: string; days?: string; from?: string; to?: string }>();
  const today = thaiToday();
  const [type, setType] = useState<EventType>(params.type === 'CANCELLED' ? 'CANCELLED' : 'STARTED');
  const [selection, setSelection] = useState<StatsSelection>(() =>
    params.days || params.from ? selectionFromParams(params) : { from: today, to: today },
  );
  const { data, isLoading, isFetching } = useAdminSubscriptionEvents(selection, type);
  const isToday = !('days' in selection) && selection.from === today && selection.to === today;
  const count = data?.counts[type] ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.chips}>
              <AdminChip label="오늘" selected={isToday} onPress={() => setSelection({ from: today, to: today })} />
              <StatsRangeControl value={selection} onChange={setSelection} />
            </View>
            <View style={styles.chips}>
              {TYPES.map((item) => (
                <AdminChip key={item.value} label={item.label} count={data?.counts[item.value]} selected={type === item.value} onPress={() => setType(item.value)} />
              ))}
              {isFetching ? <ActivityIndicator color={theme.tint} /> : null}
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              {`${selectionLabel(selection, i18n.language)} ${type === 'STARTED' ? '구독을 시작한' : '해지한'} 건 — 태국 시간 기준, 방 하나에 한 줄(묶음은 방마다)`}
              {data && data.items.length < count ? ` · 최신 ${data.limit}건만 보여요` : ''}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {type === 'STARTED' ? '이 기간에 시작한 구독이 없어요.' : '이 기간에 해지한 구독이 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: item.user.id } })}
            accessibilityRole="button"
            style={({ hovered }) => [styles.row, wide && styles.rowWide, { borderBottomColor: theme.backgroundSelected }, hovered && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" numberOfLines={1} style={wide ? styles.colName : undefined} themeColor={item.user.deletedAt ? 'textTertiary' : 'text'}>
              {fanName(item)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={wide ? styles.colRoom : undefined}>
              {roomName(item)}
              {item.type === 'STARTED' && item.priceCents != null ? ` · ${formatBaht(item.priceCents)}` : ''}
              {wide ? '' : ` · ${timeText(item.createdAt)}`}
            </ThemedText>
            {wide ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.colTime}>
                {timeText(item.createdAt)}
              </ThemedText>
            ) : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.four },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  row: { paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.two, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowWide: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  colName: { flex: 1.5 },
  colRoom: { flex: 2.5 },
  colTime: { flex: 1 },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
