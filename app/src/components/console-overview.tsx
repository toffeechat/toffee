import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Globe2, MessageCircle, Mic2, Monitor, Users, UserRound } from 'lucide-react-native';

import { DeltaBadge, Panel, RankRow } from '@/components/console-charts';
import { AreaLine, Donut, GroupedBars, PageDots } from '@/components/console-mini-charts';
import { ConsoleHeaderActions } from '@/components/console-header-actions';
import { rankItems } from '@/components/console-rank';
import { PcContinueSheet } from '@/components/pc-continue-sheet';
import { monthLabel, useMoney } from '@/components/settlement-summary';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useAgencyDashboard, type AgencyDashboard } from '@/hooks/use-console';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useMe } from '@/hooks/use-onboarding';
import { currentMonth, useSettlement } from '@/hooks/use-settlements';
import { useTheme } from '@/hooks/use-theme';
import { useDemoSwitch, useIsDemoAccount } from '@/lib/demo-switch';
import { Radius, Spacing } from '@/constants/theme';
import { repliesPerMessage } from '@/utils/dashboard-rank';
import { countryLabel } from '@/utils/stat-labels';

const CARD_GAP = Spacing.two + 2;

/**
 * 소속사 폰 첫 화면 "한눈에"(2026-11-24 사용자 결정 — 소속사 폰 화면 개선 1번): 이번 달 소속사 정산 예상액을 아주 크게, 그 아래 옆으로
 * 넘기는 통계 카드(구독 중·팬 답장·팬 나라), 아티스트별 구독자 막대, 팬·아티스트 화면 보기(데모)·PC로 이어 보기. PC 첫 화면은 대시보드 그대로.
 */
export function ConsoleOverview() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const money = useMoney(0);
  const month = currentMonth();
  const dashboard = useAgencyDashboard({ days: 30 }, 'ALL');
  const settlement = useSettlement(month, { anyPlatform: true });
  const { refreshing, onRefresh } = useManualRefresh(async () => {
    await Promise.all([dashboard.refetch(), settlement.refetch()]);
  });
  const isDemo = useIsDemoAccount();
  const { switchTo, busy, failed } = useDemoSwitch();
  const [pcOpen, setPcOpen] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [page, setPage] = useState(0);
  const cardWidth = Math.max(0, carouselWidth * 0.84);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP)));
  };

  const agency = settlement.data?.month === month ? settlement.data.agencies[0] : undefined;
  const settlementFailed = settlement.isError && !agency;
  const data = dashboard.data;

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundElement }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.flex}>
            {me?.agencyName ? (
              <ThemedText type="smallMedium" themeColor="textSecondary" numberOfLines={1}>
                {me.agencyName}
              </ThemedText>
            ) : null}
            <ThemedText type="display">{t('overview.title')}</ThemedText>
          </View>
          <ConsoleHeaderActions />
        </View>

        {/* 이번 달 소속사 몫 — 가장 크게 */}
        <Pressable
          onPress={() => router.push('/console/earnings')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.hero, { backgroundColor: theme.chart1, opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.heroTop}>
            <ThemedText type="smallMedium" style={styles.onHeroSoft} numberOfLines={1}>
              {t('overview.heroLabel')}
            </ThemedText>
            <ThemedText type="caption" style={styles.onHeroSoft}>
              {monthLabel(month, i18n.language)}
            </ThemedText>
          </View>
          {settlement.isLoading ? (
            <ActivityIndicator color="#FFFFFF" style={styles.heroLoading} />
          ) : (
            <ThemedText type="display" style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {/* 불러오기 실패면 ฿0 대신 "–"(2026-11-24 점검 5차 — 예전엔 "฿0 · 이번 달엔 아직 결제가 없어요"로 보였음) */}
              {settlementFailed ? '–' : money(agency?.payoutCents ?? 0)}
            </ThemedText>
          )}
          <ThemedText type="small" style={styles.onHeroSoft}>
            {settlementFailed
              ? t('settlement.loadFailed')
              : agency
                ? t('overview.heroSub', { gross: money(agency.grossCents + (agency.adjustmentCents ?? 0)), percent: agency.sharePercent })
                : t('overview.heroEmpty')}
          </ThemedText>
          {agency && agency.grossCents > 0 ? (
            <View style={styles.heroBar}>
              <View style={[styles.heroFill, { flex: Math.max(0, agency.payoutCents) }]} />
              <View style={[styles.heroRest, { flex: Math.max(0, agency.grossCents + (agency.adjustmentCents ?? 0) - agency.payoutCents) }]} />
            </View>
          ) : null}
          <View style={styles.heroFoot}>
            {agency?.nextShare ? (
              <ThemedText type="caption" style={[styles.onHeroSoft, styles.flex]} numberOfLines={2}>
                {t('settlementSummary.nextShare', { month: monthLabel(agency.nextShare.fromMonth, i18n.language), percent: agency.nextShare.percent })}
              </ThemedText>
            ) : (
              <View style={styles.flex} />
            )}
            <View style={styles.heroMore}>
              <ThemedText type="smallBold" style={styles.onHero}>
                {t('overview.toSettlement')}
              </ThemedText>
              <Icon as={ChevronRight} size={16} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        {/* 옆으로 넘기는 통계 카드 */}
        <View onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}>
          {data && cardWidth > 0 ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth + CARD_GAP}
                decelerationRate="fast"
                onScroll={onScroll}
                scrollEventThrottle={32}
                contentContainerStyle={styles.cards}>
                <SubscribersCard data={data} width={cardWidth} onPress={() => router.push('/console/dashboard')} />
                <RepliesCard data={data} width={cardWidth} onPress={() => router.push('/console/dashboard')} />
                <CountriesCard data={data} width={cardWidth} onPress={() => router.push('/console/dashboard')} />
              </ScrollView>
              <PageDots count={3} index={Math.min(2, page)} />
            </>
          ) : dashboard.isError && !data ? (
            // 불러오기 실패면 계속 도는 대신 안내 + 다시 시도(2026-11-24 점검 5차, 통계 화면과 같은 방식)
            <View style={styles.cardsFailed}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('dashboard.loadFailed')}
              </ThemedText>
              <Button title={t('discover.retry')} variant="secondary" onPress={() => void dashboard.refetch()} />
            </View>
          ) : (
            <ActivityIndicator style={styles.cardsLoading} color={theme.tint} />
          )}
        </View>

        {data ? <ArtistSubscribers data={data} onMore={() => router.push('/console/dashboard')} onPressItem={(id) => router.push(`/console/${id}`)} /> : null}

        {/* 데모: 팬·아티스트 화면으로 바꿔 보기 */}
        {isDemo ? (
          <View style={styles.actions}>
            <ThemedText type="caption" themeColor="textSecondary">
              {t('demoView.hint')}
            </ThemedText>
            <View style={styles.actionRow}>
              <View style={styles.flex}>
                <Button title={t('demoView.asFan')} icon={UserRound} loading={busy === 'fan'} disabled={busy !== null} onPress={() => void switchTo('fan')} />
              </View>
              <View style={styles.flex}>
                <Button title={t('demoView.asArtist')} icon={Mic2} loading={busy === 'artist'} disabled={busy !== null} onPress={() => void switchTo('artist')} />
              </View>
            </View>
            {failed ? (
              <ThemedText type="caption" themeColor="danger">
                {t('demoView.failed')}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        <Button title={t('pcContinue.open')} icon={Monitor} variant="secondary" onPress={() => setPcOpen(true)} />
      </View>
      <PcContinueSheet visible={pcOpen} onClose={() => setPcOpen(false)} />
    </ScrollView>
  );
}

function StatCard({ width, icon, label, onPress, children }: { width: number; icon: typeof Users; label: string; onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { width, backgroundColor: theme.background, borderColor: theme.border, opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: theme.tintSoft }]}>
          <Icon as={icon} size={16} color={theme.tint} strokeWidth={2} />
        </View>
        <ThemedText type="smallMedium" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      {children}
    </Pressable>
  );
}

/** 구독 중인 팬 + 30일 흐름(오늘 숫자에서 날마다 새 구독 − 해지를 거꾸로 빼서 그림) */
function SubscribersCard({ data, width, onPress }: { data: AgencyDashboard; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const current = data.totals.subscribers ?? 0;
  const net = data.totals.newSubscriptions - data.totals.cancellations;
  const series: number[] = [];
  let running = current;
  for (let i = data.daily.length - 1; i >= 0; i -= 1) {
    series.unshift(running);
    running -= data.daily[i].newSubscriptions - data.daily[i].cancellations;
  }
  return (
    <StatCard width={width} icon={Users} label={t('overview.subscribers')} onPress={onPress}>
      <View style={styles.valueRow}>
        <ThemedText type="display" style={styles.cardValue}>
          {data.totals.subscribers === null ? '–' : current.toLocaleString()}
        </ThemedText>
        <View style={[styles.netChip, { backgroundColor: net >= 0 ? theme.tintSoft : `${theme.danger}1A` }]}>
          <ThemedText type="captionBold" style={{ color: net >= 0 ? theme.tint : theme.danger }}>
            {`${net >= 0 ? '+' : ''}${net}`}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="caption" themeColor="textTertiary">
        {t('overview.subscribersSub', { days: data.days })}
      </ThemedText>
      <AreaLine values={series} />
    </StatCard>
  );
}

function RepliesCard({ data, width, onPress }: { data: AgencyDashboard; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const per = repliesPerMessage(data.totals);
  return (
    <StatCard width={width} icon={MessageCircle} label={t('overview.replies')} onPress={onPress}>
      <View style={styles.valueRow}>
        <ThemedText type="display" style={styles.cardValue}>
          {data.totals.fanReplies.toLocaleString()}
        </ThemedText>
        <DeltaBadge current={data.totals.fanReplies} previous={data.previous.fanReplies} />
      </View>
      <ThemedText type="caption" themeColor="textTertiary">
        {per === null ? t('overview.repliesNoMessages') : t('overview.repliesSub', { value: per.toFixed(1) })}
      </ThemedText>
      <GroupedBars values={data.daily.map((d) => d.fanReplies)} />
    </StatCard>
  );
}

function CountriesCard({ data, width, onPress }: { data: AgencyDashboard; width: number; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const total = data.countries.reduce((sum, row) => sum + row.count, 0);
  const top = data.countries[0];
  const rest = data.countries.slice(1, 3);
  const percent = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
  return (
    <StatCard width={width} icon={Globe2} label={t('overview.countries')} onPress={onPress}>
      {top ? (
        <View style={styles.countryRow}>
          <Donut
            size={96}
            parts={[
              { key: top.key, value: top.count, color: theme.chart1 },
              ...rest.map((row, i) => ({ key: row.key, value: row.count, color: i === 0 ? theme.chart2 : theme.tint })),
              { key: '__rest', value: Math.max(0, total - top.count - rest.reduce((sum, row) => sum + row.count, 0)), color: theme.border },
            ]}
          />
          <View style={styles.flex}>
            <ThemedText type="display" style={styles.cardValue}>{`${percent(top.count)}%`}</ThemedText>
            <ThemedText type="smallBold" numberOfLines={1}>
              {countryLabel(top.key, t, i18n.language)}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={2}>
              {rest.map((row) => `${countryLabel(row.key, t, i18n.language)} ${percent(row.count)}%`).join(' · ')}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
          {t('dashboard.noData')}
        </ThemedText>
      )}
    </StatCard>
  );
}

function ArtistSubscribers({ data, onMore, onPressItem }: { data: AgencyDashboard; onMore: () => void; onPressItem: (id: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = rankItems(data.actors, 'subscribers', t).slice(0, 5);
  const max = Math.max(0, ...items.map((item) => item.value));
  if (items.length === 0) return null;
  return (
    <Panel
      title={t('overview.byArtist')}
      icon={Users}
      right={
        <ThemedText type="smallBold" style={{ color: theme.tint }} onPress={onMore} accessibilityRole="button">
          {`${t('overview.more')} ›`}
        </ThemedText>
      }>
      {items.map((item, index) => (
        <RankRow key={item.id} rank={index + 1} item={item} max={max} onPress={() => onPressItem(item.id)} />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  // 정산 카드 — 라벤더 진한 단색(chart1) 위 흰 글자: 두 테마 모두 같은 색
  hero: { borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.one },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  heroValue: { color: '#FFFFFF', fontSize: 52, lineHeight: 62, letterSpacing: -1.5 },
  heroLoading: { height: 62 },
  onHero: { color: '#FFFFFF' },
  onHeroSoft: { color: 'rgba(255,255,255,0.86)' },
  heroBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: Spacing.two, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroFill: { backgroundColor: '#FFFFFF' },
  heroRest: { backgroundColor: 'rgba(255,255,255,0.3)' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  heroMore: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cards: { gap: CARD_GAP, paddingBottom: Spacing.two },
  cardsLoading: { height: 180 },
  cardsFailed: { height: 180, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.one, minHeight: 188 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardIcon: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  cardValue: { fontSize: 40, lineHeight: 48 },
  netChip: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  empty: { paddingVertical: Spacing.three },
  actions: { gap: Spacing.two },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
});
