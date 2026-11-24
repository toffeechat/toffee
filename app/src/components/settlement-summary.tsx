import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CloudOff, Monitor, Wallet } from 'lucide-react-native';

import { FlowBars } from '@/components/console-mini-charts';
import { Panel } from '@/components/console-charts';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { PcContinueSheet } from '@/components/pc-continue-sheet';
import { currentMonth, shiftMonth, useSettlement } from '@/hooks/use-settlements';
import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export function useMoney(fractionDigits = 2) {
  const { i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return (cents: number) => format.format(cents / 100);
}

/** "2026년 11월" / "พฤศจิกายน 2569" — 기기 언어 달력 그대로 */
export function monthLabel(month: string, language: string) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 15)).toLocaleDateString(language, { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

/**
 * 폰 정산 요약(2026-11-24 사용자 결정 — "폰에는 요약만"): 지급 예상액을 크게, 결제액 → 스토어 수수료 → 수수료 뺀 금액 → 소속사 몫 흐름 막대,
 * 아티스트별 지급 예상 막대. 방별 표·CSV·마감·지급 기록은 PC(SettlementReportView)에만. 토피 몫 금액은 소속사에 안 보여 줌(2026-10-13 결정).
 */
export function SettlementSummary() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const [month, setMonth] = useState(currentMonth);
  const [pcOpen, setPcOpen] = useState(false);
  const { data: report, isLoading, isError, refetch } = useSettlement(month, { anyPlatform: true });
  const { refreshing, onRefresh } = useManualRefresh(refetch);
  const isCurrent = month === currentMonth();
  // 소속사 직원은 자기 소속사 한 줄만 옴(서버가 좁힘)
  const agency = report?.month === month ? report.agencies[0] : undefined;
  const status = !report
    ? null
    : report.closed
      ? t('settlementSummary.closed')
      : isCurrent
        ? t('settlementSummary.openCurrent')
        : t('settlementSummary.openPast');

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundElement }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.inner}>
        <View style={styles.monthRow}>
          <IconButton icon={ChevronLeft} label={t('settlement.prevMonth')} onPress={() => setMonth(shiftMonth(month, -1))} />
          <ThemedText type="headline">{monthLabel(month, i18n.language)}</ThemedText>
          <IconButton icon={ChevronRight} label={t('settlement.nextMonth')} onPress={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} />
        </View>

        {isError && !report ? (
          <EmptyState icon={CloudOff} title={t('settlement.loadFailed')} action={<Button title={t('discover.retry')} variant="secondary" onPress={() => void refetch()} />} />
        ) : isLoading || !report || report.month !== month ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : !agency || agency.grossCents + (agency.adjustmentCents ?? 0) === 0 ? (
          <EmptyState icon={Wallet} title={t('settlement.empty')} />
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <ThemedText type="smallMedium" themeColor="textSecondary">
                {t('settlementSummary.payoutLabel')}
              </ThemedText>
              <ThemedText type="display" style={[styles.heroValue, { color: theme.chart1 }]} numberOfLines={1} adjustsFontSizeToFit>
                {money(agency.payoutCents)}
              </ThemedText>
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: theme.tintSoft }]}>
                  <ThemedText type="captionBold" style={{ color: theme.tint }}>
                    {t('settlementSummary.share', { percent: agency.sharePercent })}
                  </ThemedText>
                </View>
                {agency.nextShare ? (
                  <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="captionBold" themeColor="textSecondary">
                      {t('settlementSummary.nextShare', { month: monthLabel(agency.nextShare.fromMonth, i18n.language), percent: agency.nextShare.percent })}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {status ? (
                <ThemedText type="caption" themeColor="textTertiary">
                  {[status, report.includesSandbox ? t('settlementSummary.sandbox') : null].filter(Boolean).join(' · ')}
                </ThemedText>
              ) : null}
            </View>

            <Panel title={t('settlementSummary.flowTitle')}>
              <FlowBars
                steps={[
                  { key: 'gross', label: t('settlement.gross'), value: Math.max(0, agency.grossCents + (agency.adjustmentCents ?? 0)), display: compact(agency.grossCents + (agency.adjustmentCents ?? 0)) },
                  { key: 'fee', label: t('settlement.storeFeeShort'), value: Math.max(0, agency.storeFeeCents), base: Math.max(0, agency.netCents), display: `−${compact(agency.storeFeeCents)}` },
                  { key: 'net', label: t('settlement.net'), value: Math.max(0, agency.netCents), display: compact(agency.netCents) },
                  { key: 'payout', label: t('settlementSummary.agencyShort'), value: Math.max(0, agency.payoutCents), display: compact(agency.payoutCents), highlight: true },
                ]}
              />
              <View style={styles.rows}>
                <Row label={t('settlement.gross')} value={money(agency.grossCents)} />
                {agency.adjustmentCents ? <Row label={t('settlement.adjustment')} value={money(agency.adjustmentCents)} /> : null}
                <Row label={t('settlement.storeFee', { percent: report.storeFeePercent })} value={`−${money(agency.storeFeeCents)}`} muted />
                <Row label={t('settlement.net')} value={money(agency.netCents)} />
                <Row label={t('settlementSummary.agencyShare', { percent: agency.sharePercent })} value={money(agency.payoutCents)} strong />
                {agency.refundedCents ? <Row label={t('settlement.refunded')} value={money(agency.refundedCents)} muted /> : null}
              </View>
            </Panel>

            {agency.actors.length > 0 ? (
              <Panel title={t('settlementSummary.byArtist')}>
                {agency.actors.map((actor) => {
                  const max = Math.max(1, ...agency.actors.map((row) => row.payoutCents));
                  return (
                    <View key={actor.actorId} style={styles.artist} accessible accessibilityLabel={`${actor.name} ${money(actor.payoutCents)}`}>
                      <View style={styles.artistLine}>
                        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                          {actor.name}
                        </ThemedText>
                        <ThemedText type="headline">{money(actor.payoutCents)}</ThemedText>
                      </View>
                      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                        <View style={[styles.fill, { width: `${Math.max(2, (Math.max(0, actor.payoutCents) / max) * 100)}%`, backgroundColor: theme.chart1 }]} />
                      </View>
                    </View>
                  );
                })}
              </Panel>
            ) : null}

            <View style={[styles.pcNote, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Icon as={Monitor} size={18} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {t('settlementSummary.pcNote')}
              </ThemedText>
              <Button title={t('pcContinue.open')} size="md" variant="secondary" onPress={() => setPcOpen(true)} />
            </View>
          </>
        )}
      </View>
      <PcContinueSheet visible={pcOpen} onClose={() => setPcOpen(false)} />
    </ScrollView>
  );
}

// 막대 위 짧은 숫자(฿ 없이, 1,000 넘으면 1.4k)
function compact(cents: number) {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <ThemedText type={strong ? 'smallBold' : 'small'} themeColor={muted ? 'textSecondary' : 'text'} style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'headline' : 'smallBold'} themeColor={muted ? 'textSecondary' : 'text'} style={strong ? { color: theme.chart1 } : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.five },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: Spacing.three },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loading: { marginTop: Spacing.six },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two },
  heroValue: { fontSize: 44, lineHeight: 54, letterSpacing: -1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two + 2, paddingVertical: 4 },
  rows: { marginTop: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  artist: { gap: 6, paddingVertical: Spacing.one },
  artistLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  pcNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three },
});
