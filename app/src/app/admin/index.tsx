import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ChevronRight,
  Clock,
  Coins,
  FileClock,
  Flag,
  Globe2,
  Hourglass,
  Languages,
  LifeBuoy,
  LogIn,
  PackageX,
  Smartphone,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { DeltaBadge, DistributionBars, KpiCard, Panel, RankCard, SegmentedPills, TrendChart } from '@/components/console-charts';
import { RANK_ICONS, rankItems } from '@/components/console-rank';
import { AudiencePanels, KpiGrid, RangeCaption, TrendPanels, cellStyle, statsStyles } from '@/components/console-stats';
import { StatsRangeControl, formatStatDay } from '@/components/stats-range-picker';
import { formatBaht } from '@/components/admin-ui';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useWideLayout } from '@/components/wide-shell';
import { useAuth } from '@/lib/auth-context';
import {
  useAdminActors,
  useAppleStoreTodo,
  useContractsEnding,
  useAdminInquiries,
  useAdminAgencies,
  useAdminStatsBreakdown,
  useAdminStatsOverview,
  useAdminStatsSummary,
  useDemoStatus,
  useResetDemo,
} from '@/hooks/use-admin';
import { selectionParams, useAgencyDashboard, type RoomKindFilter, type StatsSelection } from '@/hooks/use-console';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { ApiError } from '@/lib/api-client';
import { adminMenuFor } from '@/constants/admin-menu';
import { Radius, Spacing } from '@/constants/theme';
import { RANK_METRICS, type RankMetric } from '@/utils/dashboard-rank';
import { IDLE_WARN_DAYS, idleDays } from '@/utils/idle-days';
import { isUpcoming } from '@/utils/release';
import { countryLabel, languageLabel, shortDay } from '@/utils/stat-labels';
import { useMe } from '@/hooks/use-onboarding';

const KINDS: RoomKindFilter[] = ['ALL', 'SOLO', 'COUPLE'];
const PROVIDER_NAMES: Record<string, string> = { GOOGLE: '구글', APPLE: '애플', NAVER: '네이버', KAKAO: '카카오', LINE: '라인', unknown: '알 수 없음' };
const PLATFORM_NAMES: Record<string, string> = { ios: 'iOS', android: '안드로이드', web: '웹', unknown: '알 수 없음' };

/**
 * 운영자 홈 = 통계 대시보드(2026-10-20 사용자 요청: "홈과 통계를 합치고 그래프로 눈에 확 들어오게, 소속사 웹에서 보는 건 운영자도 다").
 * 위에서부터 처리할 일 → 오늘 숫자 → 기간(최근 7·30·90일 또는 직접 고른 날짜, 최대 1년)·아티스트/CP·소속사 필터 →
 * 서비스 전체(팬·가입·신규 구독 금액) → 아티스트 활동(소속사 대시보드와 같은 카드·추이·순위) → 팬 분포.
 * 순위에서 아티스트를 누르면 소속사와 같은 모니터링 화면(메시지·팬 답장·스토리·통계). 폰에선 맨 아래에 메뉴.
 */
export default function AdminHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { data: me } = useMe();
  const wide = useWideLayout();
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState<StatsSelection>({ days: 30 });
  const [kind, setKind] = useState<RoomKindFilter>('ALL');
  const [agencyId, setAgencyId] = useState<string>('');

  const { data: summary, refetch: refetchSummary } = useAdminStatsSummary();
  const { data: overview, refetch: refetchOverview } = useAdminStatsOverview(selection);
  const { data: breakdown } = useAdminStatsBreakdown();
  const { data: dashboard, isLoading, isFetching, refetch: refetchDashboard } = useAgencyDashboard(selection, kind, agencyId || null);
  const { data: agencies } = useAdminAgencies();
  const { data: actors } = useAdminActors('');
  const { data: appleTodo } = useAppleStoreTodo();
  const { data: openInquiries } = useAdminInquiries('OPEN');
  const { data: contracts } = useContractsEnding();
  const { refreshing, onRefresh } = useManualRefresh(() => Promise.all([refetchSummary(), refetchOverview(), refetchDashboard()]));

  // 데모 서버에서만 보이는 "데모 초기화"(2026-10-01) — 데모 계정은 고정 ID라 초기화해도 로그인이 유지됨
  const { data: demo } = useDemoStatus();
  const resetDemo = useResetDemo();
  const onResetDemo = async () => {
    const ok = await confirm(
      '데모 초기화',
      '데모 데이터(아티스트·팬·메시지·구독·신고 등)를 모두 지우고 처음 상태로 되돌려요. 직접 만든 계정은 지워지고, 데모 계정(fan1@toffee.demo 등)은 그대로 로그인돼 있어요. 소속사에 데모를 보여 주는 중에는 누르지 마세요. 입장 코드·접속 기록은 지워지지 않아요.',
      '초기화',
      '취소',
    );
    if (ok) resetDemo.mutate();
  };

  // PC 넓은 화면에선 왼쪽 메뉴가 같은 목록이라 여기선 숨김
  const menu = wide ? [] : adminMenuFor(me?.adminLevel).filter((item) => !item.webOnly || Platform.OS === 'web');
  const rankCell = cellStyle(width, width >= 1100 ? 3 : width >= 640 ? 2 : 1);
  const halfCell = cellStyle(width, width >= 900 ? 2 : 1);
  const fourCell = cellStyle(width, width >= 900 ? 4 : 2);
  const todayCell = cellStyle(width, width >= 560 ? 4 : 2);
  const rankCaption = (metric: RankMetric, asOf: string | null) =>
    metric === 'idle' ? t('dashboard.todayBasis') : metric === 'subscribers' && asOf ? t('dashboard.asOf', { date: formatStatDay(asOf, i18n.language) }) : undefined;
  const rankingParams = { ...selectionParams(selection), kind, ...(agencyId ? { agencyId } : {}) };

  // 처리할 일 — 0이 아닌 것만
  const live = (actors ?? []).filter((actor) => !actor.retiredAt);
  const idleRooms = (dashboard?.actors ?? []).filter(
    (row) => !row.retiredAt && row.subscriberCount > 0 && (idleDays(row.lastBroadcastAt) ?? IDLE_WARN_DAYS) >= IDLE_WARN_DAYS,
  ).length;
  const todos: { key: string; icon: LucideIcon; count: number; label: string; danger?: boolean; onPress: () => void }[] = [
    { key: 'inquiries', icon: LifeBuoy, count: openInquiries?.counts.OPEN ?? 0, label: '답을 기다리는 1:1 문의', danger: true, onPress: () => router.push('/admin/inquiries') },
    { key: 'reports', icon: Flag, count: summary?.reports.pending ?? 0, label: '대기 중인 신고', danger: true, onPress: () => router.push('/admin/reports') },
    {
      key: 'idle',
      icon: Hourglass,
      count: idleRooms,
      label: `${IDLE_WARN_DAYS}일 넘게 메시지 없는 방(구독자 있음)`,
      danger: true,
      onPress: () => router.push({ pathname: '/console/ranking', params: { ...rankingParams, metric: 'idle' } }),
    },
    {
      key: 'store',
      icon: PackageX,
      count: live.filter((actor) => !actor.storeProductId).length,
      label: '스토어 상품 ID 없는 방(실결제 불가)',
      onPress: () => router.push('/admin/actors'),
    },
    {
      key: 'apple',
      icon: Store,
      count: (appleTodo?.actors.length ?? 0) + (appleTodo?.bundles.length ?? 0),
      label: '애플 상품 판매 중지 필요(활동 종료 방)',
      danger: true,
      onPress: () => router.push('/admin/store-todo'),
    },
    {
      key: 'contract',
      icon: FileClock,
      // 종료 예정을 아직 안 잡은 것만(잡았으면 처리한 셈)
      count: (contracts ?? []).filter((row) => !row.retireAt).length,
      label: `계약 31일 안에 끝남 — ${(contracts ?? []).filter((row) => !row.retireAt).slice(0, 3).map((row) => row.chatDisplayName).join(', ')}`,
      danger: true,
      onPress: () => {
        const open = (contracts ?? []).filter((row) => !row.retireAt);
        if (open.length === 1) router.push({ pathname: '/admin/actors/[id]', params: { id: open[0].id } });
        else router.push('/admin/actors');
      },
    },
    { key: 'release', icon: Clock, count: live.filter((actor) => isUpcoming(actor.releaseAt)).length, label: '공개 예정', onPress: () => router.push('/admin/actors') },
  ].filter((todo) => todo.count > 0);

  const today = summary
    ? [
        { icon: UserPlus, label: '오늘 가입', value: `${summary.fans.newToday}`, sub: `7일 +${summary.fans.new7d}` },
        { icon: LogIn, label: '오늘 접속', value: `${summary.fans.activeToday}`, sub: `30일 ${summary.fans.active30d}명` },
        { icon: TrendingUp, label: '오늘 구독 시작', value: `${summary.subscriptions.startedToday}`, sub: `해지 ${summary.subscriptions.cancelledToday}` },
        { icon: Activity, label: '오늘 메시지', value: `${summary.messages.starToday}`, sub: `팬 답장 ${summary.messages.fanRepliesToday}` },
      ]
    : [];

  const vs = t('dashboard.vsPrevious', { days: overview?.days ?? 0 });
  const formatDay = (day: string) => shortDay(day, i18n.language);
  const formatTooltipDay = (day: string) => `${formatDay(day)}${overview?.bucket === 'week' ? '~' : ''}`;
  const agencyName = agencies?.find((agency) => agency.id === agencyId)?.name;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundElement }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.inner} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {/* 제목은 위쪽 막대("운영자 홈") — 다시 불러오는 중이면 오른쪽에 작은 표시 */}
          {isFetching && !isLoading ? <ActivityIndicator style={styles.fetching} color={theme.textTertiary} /> : null}

          {/* 처리할 일 */}
          <View style={styles.grid}>
            {todos.length === 0 && summary ? (
              <View style={[styles.todo, { backgroundColor: theme.background, borderColor: theme.border, width: '100%' }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  지금 처리할 일이 없어요.
                </ThemedText>
              </View>
            ) : null}
            {todos.map((todo) => (
              <Pressable
                key={todo.key}
                onPress={todo.onPress}
                accessibilityRole="button"
                style={({ hovered }) => [
                  styles.todo,
                  halfCell,
                  { backgroundColor: theme.background, borderColor: todo.danger ? theme.danger : theme.border },
                  hovered && { backgroundColor: theme.backgroundSelected },
                ]}>
                <View style={[styles.todoIcon, { backgroundColor: todo.danger ? `${theme.danger}1A` : theme.tintSoft }]}>
                  <Icon as={todo.icon} size={18} color={todo.danger ? theme.danger : theme.tint} />
                </View>
                <ThemedText type="title" themeColor={todo.danger ? 'danger' : 'text'}>
                  {todo.count}
                </ThemedText>
                <ThemedText type="smallMedium" style={styles.flex} numberOfLines={2}>
                  {todo.label}
                </ThemedText>
                <Icon as={ChevronRight} size={16} color={theme.textTertiary} />
              </Pressable>
            ))}
          </View>

          {/* 오늘(태국 시간) */}
          <View style={styles.grid}>
            {today.map((tile) => (
              <View key={tile.label} style={[styles.tile, todayCell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.tileTop}>
                  <Icon as={tile.icon} size={14} color={theme.textSecondary} />
                  <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                    {tile.label}
                  </ThemedText>
                </View>
                <ThemedText type="title">{tile.value}</ThemedText>
                <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
                  {tile.sub}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* 기간·아티스트/CP·소속사 */}
          <View style={statsStyles.filters}>
            <StatsRangeControl value={selection} onChange={setSelection} />
            <SegmentedPills options={KINDS.map((value) => ({ value, label: t(`dashboard.kind.${value}`) }))} value={kind} onChange={setKind} />
          </View>
          {agencies && agencies.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.agencyRow}>
              <SegmentedPills
                options={[{ value: '', label: '모든 소속사' }, ...agencies.map((agency) => ({ value: agency.id, label: agency.name }))]}
                value={agencyId}
                onChange={setAgencyId}
              />
            </ScrollView>
          ) : null}
          <RangeCaption range={dashboard} />

          {/* 서비스 전체 — 소속사·아티스트/CP 필터와 상관없음 */}
          <ThemedText type="title" style={statsStyles.sectionTitle}>
            서비스 전체
          </ThemedText>
          {summary && overview ? (
            <>
              <View style={styles.grid}>
                <KpiCard
                  icon={Users}
                  label="전체 팬"
                  value={summary.fans.total.toLocaleString()}
                  footer={`구독률 ${Math.round(summary.subscriptions.subscriptionRate * 100)}% · 구독 중인 팬 ${summary.subscriptions.subscribedFans}명`}
                  style={fourCell}
                />
                <KpiCard
                  icon={UserPlus}
                  label="신규 가입"
                  value={overview.totals.signups.toLocaleString()}
                  delta={<DeltaBadge current={overview.totals.signups} previous={overview.previous.signups} />}
                  footer={vs}
                  spark={overview.daily.map((d) => d.signups)}
                  style={fourCell}
                />
                <KpiCard
                  icon={Coins}
                  label="신규 구독 금액"
                  value={formatBaht(overview.totals.newRevenueCents)}
                  delta={<DeltaBadge current={overview.totals.newRevenueCents} previous={overview.previous.newRevenueCents} />}
                  footer="새로 시작한 구독의 월 가격 합(할인 반영)"
                  spark={overview.daily.map((d) => d.newRevenueCents)}
                  style={fourCell}
                />
                <KpiCard
                  icon={TrendingUp}
                  label="활성 구독"
                  value={summary.subscriptions.active.toLocaleString()}
                  footer={`최근 30일 시작 ${summary.subscriptions.started30d} · 해지 ${summary.subscriptions.cancelled30d}`}
                  style={fourCell}
                />
              </View>
              <View style={styles.grid}>
                <Panel title="신규 가입 추이" icon={UserPlus} caption={overview.bucket === 'week' ? t('dashboard.weeklyNote') : undefined} style={halfCell}>
                  <TrendChart
                    days={overview.daily.map((d) => d.day)}
                    formatDay={formatDay}
                    formatTooltipDay={formatTooltipDay}
                    series={[{ label: '가입', color: theme.chart1, values: overview.daily.map((d) => d.signups) }]}
                  />
                </Panel>
                <Panel title="신규 구독 금액 추이(바트)" icon={Coins} caption="정산·갱신 매출은 정산 화면(실제 결제 기준)" style={halfCell}>
                  <TrendChart
                    days={overview.daily.map((d) => d.day)}
                    formatDay={formatDay}
                    formatTooltipDay={formatTooltipDay}
                    series={[{ label: '금액', color: theme.chart2, values: overview.daily.map((d) => Math.round(d.newRevenueCents / 100)) }]}
                  />
                </Panel>
              </View>
            </>
          ) : (
            <ActivityIndicator color={theme.tint} />
          )}

          {/* 아티스트 활동 — 소속사 대시보드와 같은 숫자(운영자는 전체 방) */}
          <ThemedText type="title" style={statsStyles.sectionTitle}>
            {agencyName ? `아티스트 활동 · ${agencyName}` : '아티스트 활동'}
          </ThemedText>
          {isLoading || !dashboard ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <>
              <KpiGrid
                width={width}
                days={dashboard.days}
                subscribers={dashboard.totals.subscribers}
                asOf={dashboard.audienceAsOf}
                netChange={dashboard.totals.newSubscriptions - dashboard.totals.cancellations}
                totals={dashboard.totals}
                previous={dashboard.previous}
                daily={dashboard.daily}
              />
              <TrendPanels width={width} daily={dashboard.daily} bucket={dashboard.bucket} />

              <ThemedText type="title" style={statsStyles.sectionTitle}>
                {t('dashboard.rankings')}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                아티스트를 누르면 소속사와 같은 모니터링 화면(보낸 메시지·팬 답장·스토리·통계)으로 가요.
              </ThemedText>
              <View style={styles.grid}>
                {RANK_METRICS.map((metric) => (
                  <RankCard
                    key={metric}
                    title={t(`dashboard.sort.${metric}`)}
                    icon={RANK_ICONS[metric]}
                    items={metric === 'subscribers' && !dashboard.audienceRecorded ? [] : rankItems(dashboard.actors, metric, t)}
                    caption={rankCaption(metric, dashboard.audienceAsOf)}
                    emptyText={t(
                      metric === 'subscribers' && !dashboard.audienceRecorded
                        ? 'dashboard.noRecord'
                        : metric === 'cancellations'
                          ? 'dashboard.noCancellations'
                          : 'dashboard.noData',
                    )}
                    onMore={() => router.push({ pathname: '/console/ranking', params: { ...rankingParams, metric } })}
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
                fans={dashboard.fans}
                countries={dashboard.countries}
                languages={dashboard.languages}
                asOf={dashboard.audienceAsOf}
                recorded={dashboard.audienceRecorded}
              />
            </>
          )}

          {breakdown ? (
            <View style={styles.grid}>
              <Panel title="가입한 팬 전체 · 나라" icon={Globe2} caption="구독 여부와 상관없이 가입한 팬 전체(가입할 때 기기 지역)" style={halfCell}>
                <DistributionBars rows={breakdown.countries} labelOf={(key) => countryLabel(key, t, i18n.language)} emptyText={t('dashboard.noData')} />
              </Panel>
              <Panel title="가입한 팬 전체 · 앱 언어" icon={Languages} style={halfCell}>
                <DistributionBars rows={breakdown.locales} labelOf={(key) => languageLabel(key, t)} emptyText={t('dashboard.noData')} />
              </Panel>
              <Panel title="가입 경로" icon={LogIn} caption="처음 가입한 로그인 방식" style={halfCell}>
                <DistributionBars rows={breakdown.providers} labelOf={(key) => PROVIDER_NAMES[key] ?? key} emptyText={t('dashboard.noData')} />
              </Panel>
              <Panel title="가입 기기" icon={Smartphone} style={halfCell}>
                <DistributionBars rows={breakdown.platforms} labelOf={(key) => PLATFORM_NAMES[key] ?? key} emptyText={t('dashboard.noData')} />
              </Panel>
            </View>
          ) : null}

          {/* 폰·좁은 창 — 메뉴(PC는 왼쪽 메뉴) */}
          {menu.length > 0 ? (
            <>
              <ThemedText type="title" style={statsStyles.sectionTitle}>
                메뉴
              </ThemedText>
              <View style={styles.grid}>
                {menu.map((item) => (
                  <Pressable
                    key={item.href}
                    onPress={() => router.push(item.href)}
                    accessibilityRole="button"
                    style={[styles.menuItem, halfCell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <View style={[styles.todoIcon, { backgroundColor: theme.tintSoft }]}>
                      <Icon as={item.icon} size={18} color={theme.tint} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{item.label}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                        {item.description}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {demo?.enabled ? (
            <View style={styles.grid}>
              {/* 소속사별 입장 코드·접속 기록(2026-10-19) — 데모 서버에서만 의미가 있어서 메뉴 목록이 아니라 여기 */}
              <Pressable
                onPress={() => router.push('/admin/demo-codes')}
                accessibilityRole="button"
                style={[styles.menuItem, halfCell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">데모 입장 코드</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    소속사별 코드·만료일·링크, 누가 언제 들어왔는지(들어오면 메일)
                  </ThemedText>
                </View>
              </Pressable>
              <Pressable
                onPress={onResetDemo}
                disabled={resetDemo.isPending}
                accessibilityRole="button"
                style={[styles.menuItem, halfCell, { backgroundColor: theme.background, borderColor: theme.border, opacity: resetDemo.isPending ? 0.6 : 1 }]}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" themeColor="danger">
                    {resetDemo.isPending ? '초기화하는 중…' : '데모 초기화'}
                  </ThemedText>
                  <ThemedText type="caption" themeColor={resetDemo.isError ? 'danger' : 'textSecondary'}>
                    {resetDemo.isError
                      ? resetDemo.error instanceof ApiError
                        ? resetDemo.error.message
                        : '초기화하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
                      : resetDemo.isSuccess
                        ? '처음 상태로 되돌렸어요.'
                        : '데모 서버에서만 보여요. 데이터를 처음 상태로 되돌려요.'}
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* PC 넓은 화면은 왼쪽 메뉴 아래에 로그아웃이 있음 */}
          {wide ? null : (
            <Pressable onPress={logout} style={[styles.logoutButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" themeColor="danger">
                로그아웃
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: Spacing.three },
  fetching: { position: 'absolute', right: 0, top: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  loading: { marginTop: Spacing.four },
  agencyRow: { paddingRight: Spacing.three },
  todo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three },
  todoIcon: { width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tile: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: 2 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three },
  logoutButton: { borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});
