import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe2, MessageCircle, Trophy, TrendingUp, UserMinus, UserPlus, Users } from 'lucide-react-native';

import { DeltaBadge, DistributionBars, KpiCard, Panel, RankRow, SegmentedPills, TrendChart } from '@/components/console-charts';
import { Donut } from '@/components/console-mini-charts';
import { rankItems } from '@/components/console-rank';
import { formatStatDay } from '@/components/stats-range-picker';
import { ThemedText } from '@/components/themed-text';
import type { ActivityTotals, DailyActivity, DashboardRow, DistributionRow } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { RANK_METRICS, repliesPerMessage, type RankMetric } from '@/utils/dashboard-rank';
import { countryLabel, languageLabel, shortDay } from '@/utils/stat-labels';

/*
 * 폰 대시보드(2026-11-24 사용자 결정 — 소속사 폰 화면 개선 3번): 폰 화면 약 5장이던 것을 2장 안팎으로. 핵심 숫자 4개를 크게 + 보조 2개는 작은 줄,
 * 추이 그래프는 탭으로 바꾸는 1개, 순위 6개는 탭으로 바꾸는 카드 1개(상위 3), 팬 나라는 도넛. PC 배치(console-stats)는 그대로.
 */

export function CompactKpis({
  days,
  subscribers,
  asOf,
  netChange,
  totals,
  previous,
  daily,
}: {
  days: number;
  subscribers: number | null;
  asOf: string | null;
  netChange: number;
  totals: ActivityTotals;
  previous: ActivityTotals;
  daily: DailyActivity[];
}) {
  const { t, i18n } = useTranslation();
  const per = repliesPerMessage(totals);
  const perBefore = repliesPerMessage(previous);
  const half = styles.half;
  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        <KpiCard
          large
          icon={Users}
          label={t('dashboard.kpi.subscribers')}
          value={subscribers === null ? '–' : subscribers.toLocaleString()}
          footer={
            subscribers === null
              ? t('dashboard.noRecordShort')
              : [asOf ? t('dashboard.asOf', { date: formatStatDay(asOf, i18n.language) }) : null, t('dashboard.netChange', { value: `${netChange >= 0 ? '+' : ''}${netChange}`, days })]
                  .filter(Boolean)
                  .join(' · ')
          }
          style={half}
        />
        <KpiCard
          large
          icon={UserPlus}
          label={t('dashboard.kpi.newSubs')}
          value={totals.newSubscriptions.toLocaleString()}
          delta={<DeltaBadge current={totals.newSubscriptions} previous={previous.newSubscriptions} />}
          spark={daily.map((d) => d.newSubscriptions)}
          style={half}
        />
        <KpiCard
          large
          icon={UserMinus}
          label={t('dashboard.kpi.cancellations')}
          value={totals.cancellations.toLocaleString()}
          delta={<DeltaBadge current={totals.cancellations} previous={previous.cancellations} good="down" />}
          spark={daily.map((d) => d.cancellations)}
          style={half}
        />
        <KpiCard
          large
          icon={MessageCircle}
          label={t('dashboard.kpi.replies')}
          value={totals.fanReplies.toLocaleString()}
          delta={<DeltaBadge current={totals.fanReplies} previous={previous.fanReplies} />}
          spark={daily.map((d) => d.fanReplies)}
          style={half}
        />
      </View>
      {/* 보조 숫자 2개 — 작은 줄 */}
      <View style={styles.grid}>
        <MiniStat label={t('dashboard.kpi.messages')} value={totals.messagesSent.toLocaleString()} delta={<DeltaBadge current={totals.messagesSent} previous={previous.messagesSent} />} />
        <MiniStat
          label={t('dashboard.kpi.engagement')}
          value={per === null ? '–' : per.toFixed(1)}
          delta={per !== null && perBefore !== null ? <DeltaBadge current={per} previous={perBefore} /> : undefined}
        />
      </View>
      <ThemedText type="caption" themeColor="textTertiary">
        {t('dashboard.vsPrevious', { days })}
      </ThemedText>
    </View>
  );
}

function MiniStat({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.mini, { backgroundColor: theme.background, borderColor: theme.border }]} accessible accessibilityLabel={`${label} ${value}`}>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.miniRow}>
        <ThemedText type="title">{value}</ThemedText>
        {delta}
      </View>
    </View>
  );
}

type TrendKey = 'subs' | 'activity';

/** 추이 그래프 1개 — 위 탭으로 구독/메시지 */
export function TrendSwitcher({ daily, bucket = 'day' }: { daily: DailyActivity[]; bucket?: 'day' | 'week' }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [key, setKey] = useState<TrendKey>('subs');
  const formatDay = (day: string) => shortDay(day, i18n.language);
  const series =
    key === 'subs'
      ? [
          { label: t('dashboard.kpi.newSubs'), color: theme.chart1, values: daily.map((d) => d.newSubscriptions) },
          { label: t('dashboard.kpi.cancellations'), color: theme.chart2, values: daily.map((d) => d.cancellations) },
        ]
      : [
          { label: t('dashboard.kpi.replies'), color: theme.chart1, values: daily.map((d) => d.fanReplies) },
          { label: t('dashboard.kpi.messages'), color: theme.chart2, values: daily.map((d) => d.messagesSent) },
        ];
  return (
    <Panel title={t('compactDashboard.trend')} icon={TrendingUp} caption={bucket === 'week' ? t('dashboard.weeklyNote') : undefined}>
      <SegmentedPills
        options={[
          { value: 'subs' as TrendKey, label: t('compactDashboard.trendSubs') },
          { value: 'activity' as TrendKey, label: t('compactDashboard.trendActivity') },
        ]}
        value={key}
        onChange={setKey}
      />
      <TrendChart days={daily.map((d) => d.day)} formatDay={formatDay} formatTooltipDay={(day) => `${formatDay(day)}${bucket === 'week' ? '~' : ''}`} series={series} />
    </Panel>
  );
}

const RANK_SHORT: Record<RankMetric, string> = {
  subscribers: 'compactDashboard.rank.subscribers',
  idle: 'compactDashboard.rank.idle',
  newSubs: 'compactDashboard.rank.newSubs',
  replies: 'compactDashboard.rank.replies',
  cancellations: 'compactDashboard.rank.cancellations',
  engagement: 'compactDashboard.rank.engagement',
};

/** 순위 6개를 카드 하나로 — 탭으로 기준을 바꾸고 상위 3 */
export function RankSwitcher({
  actors,
  subscribersUnavailable,
  emptyTextFor,
  captionFor,
  onMore,
  onPressItem,
}: {
  actors: DashboardRow[];
  /** 지난 날짜인데 하루 기록이 없으면 구독자 순위는 비움 */
  subscribersUnavailable?: boolean;
  emptyTextFor: (metric: RankMetric) => string;
  captionFor: (metric: RankMetric) => string | undefined;
  onMore: (metric: RankMetric) => void;
  onPressItem: (id: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [metric, setMetric] = useState<RankMetric>('subscribers');
  const items = metric === 'subscribers' && subscribersUnavailable ? [] : rankItems(actors, metric, t);
  const max = Math.max(0, ...items.map((item) => item.value));
  const caption = captionFor(metric);
  return (
    <Panel
      title={t('dashboard.rankings')}
      icon={Trophy}
      right={
        items.length > 0 ? (
          <ThemedText type="smallBold" style={{ color: theme.tint }} onPress={() => onMore(metric)} accessibilityRole="button">
            {`${t('dashboard.more')} ›`}
          </ThemedText>
        ) : null
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <SegmentedPills options={RANK_METRICS.map((value) => ({ value, label: t(RANK_SHORT[value]) }))} value={metric} onChange={setMetric} />
      </ScrollView>
      {caption ? (
        <ThemedText type="caption" themeColor="textTertiary">
          {caption}
        </ThemedText>
      ) : null}
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
          {emptyTextFor(metric)}
        </ThemedText>
      ) : (
        items.slice(0, 3).map((item, index) => <RankRow key={item.id} rank={index + 1} item={item} max={max} onPress={() => onPressItem(item.id)} />)
      )}
    </Panel>
  );
}

const DONUT_SLICES = 3;

/** 팬 나라 도넛(상위 3 + 나머지) + 언어 막대 */
export function AudienceCompact({
  fans,
  countries,
  languages,
  asOf,
  recorded = true,
}: {
  fans: number;
  countries: DistributionRow[];
  languages: DistributionRow[];
  asOf?: string | null;
  recorded?: boolean;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const total = countries.reduce((sum, row) => sum + row.count, 0);
  const colors = [theme.chart1, theme.chart2, theme.tint];
  const top = countries.slice(0, DONUT_SLICES);
  const rest = total - top.reduce((sum, row) => sum + row.count, 0);
  const slices = [
    ...top.map((row, i) => ({ key: row.key, label: countryLabel(row.key, t, i18n.language), value: row.count, color: colors[i] })),
    ...(rest > 0 ? [{ key: '__rest', label: t('dashboard.other'), value: rest, color: theme.border }] : []),
  ];
  const caption = !recorded
    ? t('dashboard.noRecord')
    : asOf
      ? t('dashboard.audienceBasisPast', { date: formatStatDay(asOf, i18n.language), count: fans })
      : t('dashboard.audienceBasis', { count: fans });
  return (
    <Panel title={t('dashboard.countries')} icon={Globe2} caption={caption}>
      {total === 0 ? (
        <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
          {t('dashboard.noData')}
        </ThemedText>
      ) : (
        <View style={styles.donutRow}>
          <Donut parts={slices} center={`${Math.round((slices[0].value / total) * 100)}%`} centerSub={slices[0].label} />
          <View style={styles.legend}>
            {slices.map((slice) => (
              <View key={slice.key} style={styles.legendRow} accessible accessibilityLabel={`${slice.label} ${Math.round((slice.value / total) * 100)}%`}>
                <View style={[styles.swatch, { backgroundColor: slice.color }]} />
                <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                  {slice.label}
                </ThemedText>
                <ThemedText type="headline">{`${Math.round((slice.value / total) * 100)}%`}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}
      <ThemedText type="smallBold" style={styles.subTitle}>
        {t('dashboard.languages')}
      </ThemedText>
      <DistributionBars rows={languages} labelOf={(key) => languageLabel(key, t)} limit={3} emptyText={t('dashboard.noData')} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  half: { width: '47%', flexGrow: 1 },
  mini: { flexGrow: 1, width: '47%', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, gap: 2 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  tabs: { paddingRight: Spacing.two },
  empty: { paddingVertical: Spacing.three, textAlign: 'center' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  legend: { flex: 1, gap: Spacing.two },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  subTitle: { marginTop: Spacing.two },
});
