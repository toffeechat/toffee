import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { changePercent } from '@/utils/dashboard-rank';

/*
 * 소속사 통계 화면용 그래프 부품(2026-10-13 사용자 요청: "관리자 콘솔처럼, 그래프로 눈에 확 띄게") — 차트 라이브러리 없이
 * react-native-svg로 그림(앱·PC 웹 똑같이). 색은 테마의 chart1(라벤더)·chart2(주황)만 — 글자는 늘 글자색, 계열색은 막대·선에만.
 */

/** 흰 카드(테두리 + 둥근 모서리) — 제목·오른쪽 버튼·본문 */
export function Panel({
  title,
  icon,
  right,
  caption,
  children,
  style,
}: {
  title?: string;
  icon?: LucideIcon;
  right?: ReactNode;
  caption?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }, style]}>
      {title ? (
        <View style={styles.panelHeader}>
          {icon ? (
            <View style={[styles.panelIcon, { backgroundColor: theme.tintSoft }]}>
              <Icon as={icon} size={15} color={theme.tint} strokeWidth={2} />
            </View>
          ) : null}
          <ThemedText type="headline" style={styles.flex} numberOfLines={1}>
            {title}
          </ThemedText>
          {right}
        </View>
      ) : null}
      {caption ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.panelCaption}>
          {caption}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

/** 알약 모양 선택 줄(기간·아티스트/CP) */
export function SegmentedPills<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.pills, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.pill, selected && [styles.pillSelected, { backgroundColor: theme.background }]]}>
            <ThemedText type={selected ? 'smallBold' : 'smallMedium'} themeColor={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 앞 기간 대비 증감(▲ 12%) — good: 늘어나는 게 좋은 숫자인지(해지는 줄어드는 게 좋음) */
export function DeltaBadge({ current, previous, good = 'up' }: { current: number; previous: number; good?: 'up' | 'down' }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const percent = changePercent(current, previous);
  const direction = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const color = direction === 'flat' ? theme.textTertiary : direction === good ? theme.tint : theme.danger;
  const label =
    direction === 'flat' ? t('dashboard.same') : percent === null ? t('dashboard.fromZero', { count: current }) : `${Math.abs(percent)}%`;
  return (
    <View style={[styles.delta, { backgroundColor: direction === 'flat' ? theme.backgroundElement : direction === good ? theme.tintSoft : `${theme.danger}1A` }]}>
      <Icon as={direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus} size={13} color={color} strokeWidth={2.25} />
      <ThemedText type="captionBold" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** 작은 추이선(카드 아래) — 축·숫자 없이 모양만 */
export function Sparkline({ values, color, height = 36 }: { values: number[]; color: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const path = useMemo(() => linePath(values, width, height, 3), [values, width, height]);
  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} pointerEvents="none">
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height}>
          <Path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity={0.12} />
          <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** 숫자 카드 — 아이콘·이름·큰 숫자·증감·작은 추이선 */
export function KpiCard({
  icon,
  label,
  value,
  footer,
  delta,
  spark,
  style,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  footer?: string;
  delta?: ReactNode;
  spark?: number[];
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: theme.background, borderColor: theme.border }, style]} accessible accessibilityLabel={`${label} ${value} ${footer ?? ''}`}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: theme.tintSoft }]}>
          <Icon as={icon} size={16} color={theme.tint} strokeWidth={2} />
        </View>
        <ThemedText type="smallMedium" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.kpiValueRow}>
        <ThemedText type="display" style={styles.kpiValue} numberOfLines={1}>
          {value}
        </ThemedText>
        {delta}
      </View>
      {footer ? (
        <ThemedText type="caption" themeColor="textTertiary" numberOfLines={2}>
          {footer}
        </ThemedText>
      ) : null}
      {spark ? <Sparkline values={spark} color={theme.chart1} /> : null}
    </View>
  );
}

/** 위·아래 여백을 둔 꺾은선 경로 */
function linePath(values: number[], width: number, height: number, pad: number, max = Math.max(1, ...values)) {
  if (values.length < 2 || width <= 0) return '';
  const step = width / (values.length - 1);
  return values
    .map((value, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(pad + (1 - value / max) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');
}

/** 눈금 최댓값 — 1·2·5 단위로 올림(축 숫자가 깔끔하게) */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return unit * power;
}

const PLOT_HEIGHT = 168;
const AXIS_WIDTH = 34;

/**
 * 날짜별 추이(꺾은선, 첫 계열은 아래를 옅게 채움) — 범례에 기간 합계, 손가락/마우스를 올리면 그 날 숫자 말풍선.
 * 계열은 같은 단위(명·개)만 한 축에 — 단위가 다르면 그래프를 나눌 것.
 */
export function TrendChart({
  days,
  series,
  formatDay,
}: {
  days: string[];
  series: { label: string; color: string; values: number[] }[];
  formatDay: (day: string) => string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const step = days.length > 1 ? plotWidth / (days.length - 1) : 0;
  const yOf = (value: number) => 6 + (1 - value / max) * (PLOT_HEIGHT - 12);
  const xOf = (index: number) => index * step;
  const labelEvery = Math.max(1, Math.ceil(days.length / (width > 560 ? 8 : 5)));

  const pick = (x: number) => {
    if (step <= 0) return;
    setActive(Math.max(0, Math.min(days.length - 1, Math.round((x - AXIS_WIDTH) / step))));
  };
  const onTouch = (event: GestureResponderEvent) => pick(event.nativeEvent.locationX);

  return (
    <View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {s.label}
            </ThemedText>
            <ThemedText type="smallBold">{s.values.reduce((a, b) => a + b, 0).toLocaleString()}</ThemedText>
          </View>
        ))}
      </View>
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height: PLOT_HEIGHT + 22 }}>
        {width > 0 ? (
          <>
            {/* 눈금(0·절반·최대) */}
            {[max, max / 2, 0].map((tick) => (
              <ThemedText key={tick} type="caption" themeColor="textTertiary" style={[styles.tick, { top: yOf(tick) - 8 }]}>
                {Number.isInteger(tick) ? tick.toLocaleString() : tick.toFixed(1)}
              </ThemedText>
            ))}
            <Svg width={plotWidth} height={PLOT_HEIGHT} style={{ marginLeft: AXIS_WIDTH }}>
              <Defs>
                <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={series[0]?.color ?? theme.tint} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={series[0]?.color ?? theme.tint} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {[max, max / 2, 0].map((tick) => (
                <Line key={tick} x1={0} x2={plotWidth} y1={yOf(tick)} y2={yOf(tick)} stroke={theme.border} strokeWidth={1} strokeDasharray={tick === 0 ? undefined : '3 4'} />
              ))}
              {series[0] && days.length > 1 ? (
                <Path
                  d={`${series[0].values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(v)}`).join(' ')} L ${xOf(days.length - 1)} ${yOf(0)} L 0 ${yOf(0)} Z`}
                  fill="url(#trendFill)"
                />
              ) : null}
              {series.map((s) =>
                days.length > 1 ? (
                  <Path
                    key={s.label}
                    d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(v)}`).join(' ')}
                    stroke={s.color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null,
              )}
              {active !== null ? (
                <>
                  <Line x1={xOf(active)} x2={xOf(active)} y1={0} y2={PLOT_HEIGHT} stroke={theme.textTertiary} strokeWidth={1} />
                  {series.map((s) => (
                    <Circle key={s.label} cx={xOf(active)} cy={yOf(s.values[active] ?? 0)} r={4.5} fill={s.color} stroke={theme.background} strokeWidth={2} />
                  ))}
                </>
              ) : null}
            </Svg>
            {/* 날짜 */}
            <View style={[styles.axis, { marginLeft: AXIS_WIDTH }]}>
              {days.map((day, i) =>
                // 마지막 날짜는 늘 보이게 — 바로 앞의 규칙 눈금과 겹치면 그 눈금을 뺌
                i === days.length - 1 || (i % labelEvery === 0 && xOf(days.length - 1) - xOf(i) >= 44) ? (
                  <ThemedText
                    key={day}
                    type="caption"
                    themeColor="textTertiary"
                    style={[styles.axisLabel, { left: Math.min(Math.max(0, xOf(i) - 20), plotWidth - 40) }]}>
                    {formatDay(day)}
                  </ThemedText>
                ) : null,
              )}
            </View>
            {/* 손가락·마우스 위치를 받는 투명 판(말풍선보다 아래) */}
            <View
              style={[StyleSheet.absoluteFill, styles.hitArea]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={onTouch}
              onResponderMove={onTouch}
              onResponderRelease={() => setActive(null)}
              onResponderTerminate={() => setActive(null)}
              onPointerMove={(event) => pick(event.nativeEvent.offsetX)}
              onPointerLeave={() => setActive(null)}
            />
            {active !== null ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  { backgroundColor: theme.primary },
                  xOf(active) > plotWidth / 2 ? { right: plotWidth - xOf(active) + 12 } : { left: AXIS_WIDTH + xOf(active) + 12 },
                ]}>
                <ThemedText type="captionBold" style={{ color: theme.onPrimary }}>
                  {formatDay(days[active])}
                </ThemedText>
                {series.map((s) => (
                  <View key={s.label} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
                    <ThemedText type="caption" style={{ color: theme.onPrimary }}>
                      {`${s.label} ${(s.values[active] ?? 0).toLocaleString()}`}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

export interface RankItem {
  id: string;
  name: string;
  imageUri?: string | null;
  /** 막대 길이(같은 카드 안에서 비교) */
  value: number;
  /** 오른쪽 숫자 글 */
  display: string;
  sub?: string;
  warn?: boolean;
}

/** 순위 한 줄 — 순위·사진·이름·막대·숫자 */
export function RankRow({ rank, item, max, onPress }: { rank: number; item: RankItem; max: number; onPress?: () => void }) {
  const theme = useTheme();
  const top = rank <= 3;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ hovered, pressed }) => [styles.rankRow, (hovered || pressed) && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.rankBadge, { backgroundColor: rank === 1 ? theme.tint : top ? theme.tintSoft : 'transparent' }]}>
        <ThemedText type="captionBold" style={{ color: rank === 1 ? '#fff' : top ? theme.tint : theme.textTertiary }}>
          {rank}
        </ThemedText>
      </View>
      <Avatar uri={item.imageUri} size={30} />
      <View style={styles.rankBody}>
        <View style={styles.rankLine}>
          <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText type="smallBold" themeColor={item.warn ? 'danger' : 'text'} numberOfLines={1}>
            {item.display}
          </ThemedText>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View
            style={[
              styles.bar,
              { width: `${max > 0 ? Math.max(3, (item.value / max) * 100) : 3}%`, backgroundColor: item.warn ? theme.danger : rank === 1 ? theme.chart1 : `${theme.chart1}B3` },
            ]}
          />
        </View>
        {item.sub ? (
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
            {item.sub}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** 순위 카드 — 상위 limit개 + "전체 순위" */
export function RankCard({
  title,
  icon,
  items,
  limit = 5,
  onMore,
  onPressItem,
  emptyText,
  style,
}: {
  title: string;
  icon: LucideIcon;
  items: RankItem[];
  limit?: number;
  onMore?: () => void;
  onPressItem?: (id: string) => void;
  emptyText: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <Panel
      title={title}
      icon={icon}
      style={style}
      right={
        onMore && items.length > 0 ? (
          <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button" style={styles.more}>
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {t('dashboard.more')}
            </ThemedText>
            <Icon as={ChevronRight} size={15} color={theme.tint} />
          </Pressable>
        ) : null
      }>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
          {emptyText}
        </ThemedText>
      ) : (
        items.slice(0, limit).map((item, index) => (
          <RankRow key={item.id} rank={index + 1} item={item} max={max} onPress={onPressItem ? () => onPressItem(item.id) : undefined} />
        ))
      )}
    </Panel>
  );
}

/** 비율 막대 목록(나라·언어·메시지 종류) — 상위 limit개, 나머지는 "더보기"로 펼침 */
export function DistributionBars({ rows, labelOf, limit = 5, emptyText }: { rows: { key: string; count: number }[]; labelOf: (key: string) => string; limit?: number; emptyText: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return (
      <ThemedText type="small" themeColor="textTertiary" style={styles.empty}>
        {emptyText}
      </ThemedText>
    );
  }
  const shown = expanded ? rows : rows.slice(0, limit);
  return (
    <View style={styles.distribution}>
      {/* 한 줄 100% 막대 — 1위 비중이 바로 보이게 */}
      <View style={[styles.stack, { backgroundColor: theme.backgroundElement }]}>
        {rows.slice(0, 1).map((row) => (
          <View key={row.key} style={[styles.stackFill, { width: `${(row.count / total) * 100}%`, backgroundColor: theme.chart1 }]} />
        ))}
      </View>
      {shown.map((row, index) => {
        const percent = Math.round((row.count / total) * 100);
        return (
          <View key={row.key} style={styles.distRow} accessible accessibilityLabel={`${labelOf(row.key)} ${percent}% ${row.count}`}>
            <ThemedText type="smallMedium" style={styles.distLabel} numberOfLines={1}>
              {labelOf(row.key)}
            </ThemedText>
            <View style={[styles.distTrack, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.bar, { width: `${Math.max(2, percent)}%`, backgroundColor: index === 0 ? theme.chart1 : `${theme.chart1}99` }]} />
            </View>
            <ThemedText type="smallBold" style={styles.distPercent}>
              {`${percent}%`}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.distCount}>
              {row.count.toLocaleString()}
            </ThemedText>
          </View>
        );
      })}
      {rows.length > limit ? (
        <Pressable onPress={() => setExpanded((value) => !value)} hitSlop={6} accessibilityRole="button" style={styles.expand}>
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            {expanded ? t('dashboard.less') : t('dashboard.moreCount', { count: rows.length - limit })}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  panelIcon: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  panelCaption: { marginTop: -Spacing.one },
  pills: { flexDirection: 'row', borderRadius: Radius.pill, padding: 3, gap: 2, alignSelf: 'flex-start' },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  pillSelected: { shadowColor: '#0F1115', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  kpi: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.one, minWidth: 0 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kpiIcon: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  kpiValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.one },
  kpiValue: { fontSize: 30, lineHeight: 38 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginBottom: Spacing.two },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  tick: { position: 'absolute', left: 0, width: AXIS_WIDTH - 6, textAlign: 'right' },
  axis: { height: 20, position: 'relative' },
  axisLabel: { position: 'absolute', top: 4, width: 40, textAlign: 'center' },
  hitArea: { zIndex: 1 },
  tooltip: { position: 'absolute', top: 4, zIndex: 2, borderRadius: Radius.sm, paddingHorizontal: Spacing.two, paddingVertical: 6, gap: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6, paddingHorizontal: 4, borderRadius: Radius.md },
  rankBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankBody: { flex: 1, gap: 4, minWidth: 0 },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  empty: { paddingVertical: Spacing.three, textAlign: 'center' },
  distribution: { gap: Spacing.two },
  stack: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', marginBottom: Spacing.one },
  stackFill: { height: '100%' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  distLabel: { width: 96 },
  distTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  distPercent: { width: 40, textAlign: 'right' },
  distCount: { width: 36, textAlign: 'right' },
  expand: { alignSelf: 'flex-start', paddingTop: Spacing.one },
});
