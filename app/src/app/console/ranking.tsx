import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RankRow, SegmentedPills } from '@/components/console-charts';
import { rankItems } from '@/components/console-rank';
import { PeriodPills } from '@/components/console-stats';
import { ThemedText } from '@/components/themed-text';
import { STATS_PERIODS, useAgencyDashboard, type RoomKindFilter, type StatsPeriod } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { isRankMetric, RANK_METRICS, type RankMetric } from '@/utils/dashboard-rank';
import { Radius, Spacing } from '@/constants/theme';

const KINDS: RoomKindFilter[] = ['ALL', 'SOLO', 'COUPLE'];

/** 대시보드 순위 카드의 "더보기" — 그 기준의 전체 순위(기준·기간·아티스트/CP를 여기서도 바꿀 수 있음) */
export default function ConsoleRankingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ metric?: string; days?: string; kind?: string }>();
  const [metric, setMetric] = useState<RankMetric>(isRankMetric(params.metric) ? params.metric : 'subscribers');
  const [days, setDays] = useState<StatsPeriod>(STATS_PERIODS.find((value) => String(value) === params.days) ?? 30);
  const [kind, setKind] = useState<RoomKindFilter>(KINDS.find((value) => value === params.kind) ?? 'ALL');
  const { data, isLoading } = useAgencyDashboard(days, kind);
  const items = data ? rankItems(data.actors, metric, t) : [];
  const max = Math.max(0, ...items.map((item) => item.value));

  useEffect(() => {
    navigation.setOptions({ title: t('dashboard.fullRanking') });
  }, [navigation, t]);

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.metrics}>
            {RANK_METRICS.map((key) => (
              <ThemedText
                key={key}
                type={metric === key ? 'smallBold' : 'smallMedium'}
                onPress={() => setMetric(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: metric === key }}
                style={[styles.metric, { backgroundColor: metric === key ? theme.primary : theme.backgroundElement, color: metric === key ? theme.onPrimary : theme.text }]}>
                {t(`dashboard.sort.${key}`)}
              </ThemedText>
            ))}
          </View>
          <View style={styles.filters}>
            <SegmentedPills options={KINDS.map((value) => ({ value, label: t(`dashboard.kind.${value}`) }))} value={kind} onChange={setKind} />
            <PeriodPills value={days} onChange={setDays} />
          </View>
          {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? null : (
          <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
            {t(metric === 'cancellations' ? 'dashboard.noCancellations' : 'dashboard.noData')}
          </ThemedText>
        )
      }
      renderItem={({ item, index }) => <RankRow rank={index + 1} item={item} max={max} onPress={() => router.push(`/console/${item.id}`)} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: 2, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { gap: Spacing.three, marginBottom: Spacing.two },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metric: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
