import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RankCard, SegmentedPills } from '@/components/console-charts';
import { RANK_ICONS, rankItems } from '@/components/console-rank';
import { AudiencePanels, KpiGrid, PeriodPills, ScreenIntro, TrendPanels, cellStyle, statsStyles } from '@/components/console-stats';
import { ThemedText } from '@/components/themed-text';
import { useAgencyDashboard, type RoomKindFilter, type StatsPeriod } from '@/hooks/use-console';
import { useMe } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { RANK_METRICS } from '@/utils/dashboard-rank';
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
  const { t } = useTranslation();
  const { data: me } = useMe();
  // 위쪽 막대가 없는 탭이라 상태 표시줄(시계·노치)만큼 띄움
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<StatsPeriod>(30);
  const [kind, setKind] = useState<RoomKindFilter>('ALL');
  const [width, setWidth] = useState(0);
  const { data, isLoading, isFetching, refetch } = useAgencyDashboard(days, kind);
  const rankCell = cellStyle(width, width >= 1100 ? 3 : width >= 640 ? 2 : 1);

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundElement }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />}>
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
          <PeriodPills value={days} onChange={setDays} />
        </View>
        <ThemedText type="caption" themeColor="textTertiary">
          {t('dashboard.basis', { days })}
        </ThemedText>

        {isLoading || !data ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : (
          <>
            <KpiGrid
              width={width}
              days={days}
              subscribers={data.totals.subscribers}
              netChange={data.totals.newSubscriptions - data.totals.cancellations}
              totals={data.totals}
              previous={data.previous}
              daily={data.daily}
            />
            <TrendPanels width={width} daily={data.daily} />

            <ThemedText type="title" style={statsStyles.sectionTitle}>
              {t('dashboard.rankings')}
            </ThemedText>
            <View style={styles.grid}>
              {RANK_METRICS.map((metric) => (
                <RankCard
                  key={metric}
                  title={t(`dashboard.sort.${metric}`)}
                  icon={RANK_ICONS[metric]}
                  items={rankItems(data.actors, metric, t)}
                  emptyText={t(metric === 'cancellations' ? 'dashboard.noCancellations' : 'dashboard.noData')}
                  onMore={() => router.push({ pathname: '/console/ranking', params: { metric, days: String(days), kind } })}
                  onPressItem={(id) => router.push(`/console/${id}`)}
                  style={rankCell}
                />
              ))}
            </View>

            <ThemedText type="title" style={statsStyles.sectionTitle}>
              {t('dashboard.audience')}
            </ThemedText>
            <AudiencePanels width={width} fans={data.fans} countries={data.countries} languages={data.languages} />
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
