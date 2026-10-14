import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Info, Languages, MessageCircle, MessageSquareReply, Globe2, Send, TrendingUp, UserMinus, UserPlus, Users } from 'lucide-react-native';

import { DeltaBadge, DistributionBars, KpiCard, Panel, TrendChart } from '@/components/console-charts';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import type { ActivityTotals, DailyActivity, DistributionRow } from '@/hooks/use-console';
import { formatStatDay } from '@/components/stats-range-picker';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { repliesPerMessage } from '@/utils/dashboard-rank';
import { countryLabel, languageLabel, shortDay } from '@/utils/stat-labels';

/*
 * 소속사 대시보드와 아티스트별 통계 탭이 같이 쓰는 구역(2026-10-13) — 숫자 카드 6개, 추이 그래프 2개, 팬 나라·언어.
 * 폭에 따라 칸 수만 바뀜(폰 2칸, PC 3칸 / 그래프·분포는 PC에서 2칸).
 */

/** 화면 맨 위 한 줄 설명(2026-10-13 사용자 요청: 탭마다 무슨 화면인지) */
export function ScreenIntro({ text, style }: { text: string; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.intro, { backgroundColor: theme.backgroundElement }, style]}>
      <Icon as={Info} size={15} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

/** 기간 설명 한 줄 — "태국 시간 기준 최근 30일 · …" 또는 "8월 1일 ~ 9월 15일(46일) · …" */
export function RangeCaption({ range }: { range: { from: string; to: string; days: number } | undefined; }) {
  const { t, i18n } = useTranslation();
  if (!range) return null;
  return (
    <ThemedText type="caption" themeColor="textTertiary">
      {t('dashboard.basisRange', { from: formatStatDay(range.from, i18n.language), to: formatStatDay(range.to, i18n.language), days: range.days })}
    </ThemedText>
  );
}

/** 칸 수에 맞는 카드 폭(사이 간격 Spacing.three) */
export function cellStyle(width: number, columns: number): ViewStyle {
  if (width <= 0) return { width: '100%' };
  return { width: (width - Spacing.three * (columns - 1)) / columns };
}

export function KpiGrid({
  width,
  days,
  subscribers,
  asOf,
  netChange,
  totals,
  previous,
  daily,
}: {
  width: number;
  /** 고른 기간 일수(앞 기간 비교 문구) */
  days: number;
  /** null = 그날 하루 기록이 없음 */
  subscribers: number | null;
  /** 지난 날짜로 끝나는 기간이면 그날("구독 중"이 그날 기준) */
  asOf: string | null;
  netChange: number;
  totals: ActivityTotals;
  previous: ActivityTotals;
  daily: DailyActivity[];
}) {
  const { t, i18n } = useTranslation();
  const columns = width >= 900 ? 3 : 2;
  const cell = cellStyle(width, columns);
  const per = repliesPerMessage(totals);
  const perBefore = repliesPerMessage(previous);
  const vs = t('dashboard.vsPrevious', { days });
  const cards = [
    {
      icon: Users,
      label: t('dashboard.kpi.subscribers'),
      value: subscribers === null ? '–' : subscribers.toLocaleString(),
      footer:
        subscribers === null
          ? t('dashboard.noRecordShort')
          : [asOf ? t('dashboard.asOf', { date: formatStatDay(asOf, i18n.language) }) : null, t('dashboard.netChange', { value: `${netChange >= 0 ? '+' : ''}${netChange}`, days })]
              .filter(Boolean)
              .join(' · '),
    },
    {
      icon: UserPlus,
      label: t('dashboard.kpi.newSubs'),
      value: totals.newSubscriptions.toLocaleString(),
      delta: <DeltaBadge current={totals.newSubscriptions} previous={previous.newSubscriptions} />,
      footer: vs,
      spark: daily.map((d) => d.newSubscriptions),
    },
    {
      icon: UserMinus,
      label: t('dashboard.kpi.cancellations'),
      value: totals.cancellations.toLocaleString(),
      delta: <DeltaBadge current={totals.cancellations} previous={previous.cancellations} good="down" />,
      footer: vs,
      spark: daily.map((d) => d.cancellations),
    },
    {
      icon: Send,
      label: t('dashboard.kpi.messages'),
      value: totals.messagesSent.toLocaleString(),
      delta: <DeltaBadge current={totals.messagesSent} previous={previous.messagesSent} />,
      footer: vs,
      spark: daily.map((d) => d.messagesSent),
    },
    {
      icon: MessageCircle,
      label: t('dashboard.kpi.replies'),
      value: totals.fanReplies.toLocaleString(),
      delta: <DeltaBadge current={totals.fanReplies} previous={previous.fanReplies} />,
      footer: vs,
      spark: daily.map((d) => d.fanReplies),
    },
    {
      icon: MessageSquareReply,
      label: t('dashboard.kpi.engagement'),
      value: per === null ? '–' : per.toFixed(1),
      delta: per !== null && perBefore !== null ? <DeltaBadge current={per} previous={perBefore} /> : undefined,
      footer: t('dashboard.engagementHint'),
    },
  ];
  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} style={cell} />
      ))}
    </View>
  );
}

export function TrendPanels({ width, daily, bucket = 'day' }: { width: number; daily: DailyActivity[]; bucket?: 'day' | 'week' }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const cell = cellStyle(width, width >= 900 ? 2 : 1);
  const days = daily.map((d) => d.day);
  // 주 단위(3개월 넘는 기간)면 축은 그 주 첫날, 말풍선은 "9. 1.~"
  const formatDay = (day: string) => shortDay(day, i18n.language);
  const formatTooltipDay = (day: string) => `${formatDay(day)}${bucket === 'week' ? '~' : ''}`;
  const caption = bucket === 'week' ? t('dashboard.weeklyNote') : undefined;
  return (
    <View style={styles.grid}>
      <Panel title={t('dashboard.trendSubs')} icon={TrendingUp} caption={caption} style={cell}>
        <TrendChart
          days={days}
          formatDay={formatDay}
          formatTooltipDay={formatTooltipDay}
          series={[
            { label: t('dashboard.kpi.newSubs'), color: theme.chart1, values: daily.map((d) => d.newSubscriptions) },
            { label: t('dashboard.kpi.cancellations'), color: theme.chart2, values: daily.map((d) => d.cancellations) },
          ]}
        />
      </Panel>
      <Panel title={t('dashboard.trendActivity')} icon={MessageCircle} caption={caption} style={cell}>
        <TrendChart
          days={days}
          formatDay={formatDay}
          formatTooltipDay={formatTooltipDay}
          series={[
            { label: t('dashboard.kpi.replies'), color: theme.chart1, values: daily.map((d) => d.fanReplies) },
            { label: t('dashboard.kpi.messages'), color: theme.chart2, values: daily.map((d) => d.messagesSent) },
          ]}
        />
      </Panel>
    </View>
  );
}

/** 팬 나라·언어(지금 구독 중인 팬 기준, 적은 묶음은 서버가 "기타"로 합침) */
export function AudiencePanels({
  width,
  fans,
  countries,
  languages,
  asOf,
  recorded = true,
}: {
  width: number;
  fans: number;
  countries: DistributionRow[];
  languages: DistributionRow[];
  /** 지난 날짜로 끝나는 기간 — 그날 하루 기록(방마다 더한 구독 수) */
  asOf?: string | null;
  recorded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const cell = cellStyle(width, width >= 900 ? 2 : 1);
  const caption = !recorded
    ? t('dashboard.noRecord')
    : asOf
      ? t('dashboard.audienceBasisPast', { date: formatStatDay(asOf, i18n.language), count: fans })
      : t('dashboard.audienceBasis', { count: fans });
  return (
    <View style={styles.grid}>
      <Panel title={t('dashboard.countries')} icon={Globe2} caption={caption} style={cell}>
        <DistributionBars rows={countries} labelOf={(key) => countryLabel(key, t, i18n.language)} emptyText={t('dashboard.noData')} />
      </Panel>
      <Panel title={t('dashboard.languages')} icon={Languages} caption={caption} style={cell}>
        <DistributionBars rows={languages} labelOf={(key) => languageLabel(key, t)} emptyText={t('dashboard.noData')} />
      </Panel>
    </View>
  );
}

export const statsStyles = StyleSheet.create({
  section: { gap: Spacing.three },
  sectionTitle: { marginTop: Spacing.two },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
