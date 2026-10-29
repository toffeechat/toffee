import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CloudOff } from 'lucide-react-native';

import { RankCard, SegmentedPills } from '@/components/console-charts';
import { RANK_ICONS, rankItems } from '@/components/console-rank';
import { AudiencePanels, KpiGrid, RangeCaption, ScreenIntro, TrendPanels, cellStyle, statsStyles } from '@/components/console-stats';
import { StatsRangeControl, formatStatDay } from '@/components/stats-range-picker';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { selectionParams, useAgencyDashboard, type RoomKindFilter, type StatsSelection } from '@/hooks/use-console';
import { useMe } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { RANK_METRICS, type RankMetric } from '@/utils/dashboard-rank';
import { Spacing } from '@/constants/theme';

const KINDS: RoomKindFilter[] = ['ALL', 'SOLO', 'COUPLE'];

/**
 * 소속사 첫 화면 = 통계 대시보드(2026-10-13 사용자 피드백 개편: "관리자 콘솔처럼 한 화면에, 그래프로 눈에 확 띄게"). 위에서부터
 * 기간·아티스트/CP 필터 → 숫자 카드 6개(앞 기간 대비 증감 + 작은 추이선) → 추이 그래프 2개 → 순위 카드 6개(상위 5 + 전체 순위)
 * → 팬 나라·언어. 숫자는 서버(GET /actors/mine/dashboard)가 태국 날짜 기준으로 셈.
 */
export default function AgencyDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  // 위쪽 막대가 없는 탭이라 상태 표시줄(시계·노치)만큼 띄움
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<StatsSelection>({ days: 30 });
  const [kind, setKind] = useState<RoomKindFilter>('ALL');
  const [width, setWidth] = useState(0);
  const { data, isLoading, isError, isFetching, refetch } = useAgencyDashboard(selection, kind);
  const { refreshing, onRefresh } = useManualRefresh(refetch);
  const rankCell = cellStyle(width, width >= 1100 ? 3 : width >= 640 ? 2 : 1);
  // 오래 안 보낸 순은 기간과 상관없이 오늘 기준, 구독자 순은 지난 날짜면 그날 기준
  const rankCaption = (metric: RankMetric, asOf: string | null) =>
    metric === 'idle' ? t('dashboard.todayBasis') : metric === 'subscribers' && asOf ? t('dashboard.asOf', { date: formatStatDay(asOf, i18n.language) }) : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundElement }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.inner} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <View style={styles.flex}>
            {me?.agencyName ? (
              <ThemedText type="smallMedium" themeColor="textSecondary" numberOfLines={1}>
                {me.agencyName}
              </ThemedText>
            ) : null}
            <ThemedText type="display">{t('dashboard.title')}</ThemedText>
          </View>
          {isFetching && !isLoading ? <ActivityIndicator color={theme.textTertiary} /> : null}
        </View>
        <ScreenIntro text={t('dashboard.description')} />
        <View style={statsStyles.filters}>
          <SegmentedPills options={KINDS.map((value) => ({ value, label: t(`dashboard.kind.${value}`) }))} value={kind} onChange={setKind} />
          <StatsRangeControl value={selection} onChange={setSelection} />
        </View>
        <RangeCaption range={data} />

        {/* 불러오기 실패면 계속 도는 대신 안내 + 다시 시도(2026-10-29) */}
        {isError && !data ? (
          <EmptyState icon={CloudOff} title={t('dashboard.loadFailed')} action={<Button title={t('discover.retry')} variant="secondary" onPress={() => void refetch()} />} />
        ) : isLoading || !data ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : (
          <>
            <KpiGrid
              width={width}
              days={data.days}
              subscribers={data.totals.subscribers}
              asOf={data.audienceAsOf}
              netChange={data.totals.newSubscriptions - data.totals.cancellations}
              totals={data.totals}
              previous={data.previous}
              daily={data.daily}
            />
            <TrendPanels width={width} daily={data.daily} bucket={data.bucket} />

            <ThemedText type="title" style={statsStyles.sectionTitle}>
              {t('dashboard.rankings')}
            </ThemedText>
            <View style={styles.grid}>
              {RANK_METRICS.map((metric) => (
                <RankCard
                  key={metric}
                  title={t(`dashboard.sort.${metric}`)}
                  icon={RANK_ICONS[metric]}
                  // 지난 날짜인데 하루 기록이 없으면 구독자 순위는 비움
                  items={metric === 'subscribers' && !data.audienceRecorded ? [] : rankItems(data.actors, metric, t)}
                  caption={rankCaption(metric, data.audienceAsOf)}
                  emptyText={t(
                    metric === 'subscribers' && !data.audienceRecorded ? 'dashboard.noRecord' : metric === 'cancellations' ? 'dashboard.noCancellations' : 'dashboard.noData',
                  )}
                  onMore={() => router.push({ pathname: '/console/ranking', params: { metric, ...selectionParams(selection), kind } })}
                  onPressItem={(id) => router.push(`/console/${id}`)}
                  style={rankCell}
                />
              ))}
            </View>

            <ThemedText type="title" style={statsStyles.sectionTitle}>
              {t('dashboard.audience')}
            </ThemedText>
            <AudiencePanels
              width={width}
              fans={data.fans}
              countries={data.countries}
              languages={data.languages}
              asOf={data.audienceAsOf}
              recorded={data.audienceRecorded}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  loading: { marginTop: Spacing.six },
});
