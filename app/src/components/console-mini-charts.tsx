import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/*
 * 소속사 폰 화면용 작은 그래프(2026-11-24 — 폰 화면 개선: "큼직한 숫자 + 그래프·통계 카드") — 도넛, 누적 면 그래프, 묶음 막대, 정산 흐름 막대.
 * react-native-svg·View만(앱·웹 같음). 색은 테마 chart1·chart2·tintSoft.
 */

export interface DonutPart {
  key: string;
  value: number;
  color: string;
}

/** 도넛 — 가운데 큰 글(예: 54%) */
export function Donut({ parts, size = 112, thickness = 16, center, centerSub }: { parts: DonutPart[]; size?: number; thickness?: number; center?: string; centerSub?: string }) {
  const theme = useTheme();
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundElement} strokeWidth={thickness} fill="none" />
        {total > 0
          ? parts.map((part) => {
              const length = (part.value / total) * c;
              // 조각 사이 작은 틈(조각이 하나면 틈 없이)
              const gap = parts.length > 1 ? Math.min(2, length / 2) : 0;
              const element = (
                <Circle
                  key={part.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={part.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${Math.max(0, length - gap)} ${c}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += length;
              return element;
            })
          : null}
      </Svg>
      {center ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ThemedText type="headline" style={styles.centerText}>
            {center}
          </ThemedText>
          {centerSub ? (
            <ThemedText type="caption" themeColor="textTertiary">
              {centerSub}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** 누적 면 그래프(구독 중인 팬 수 흐름) — 축 없이 모양 + 끝점 강조 */
export function AreaLine({ values, height = 72 }: { values: number[]; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pad = 6;
  const points = values.map((value, i) => [values.length > 1 ? (i / (values.length - 1)) * width : 0, pad + (1 - (value - min) / span) * (height - pad * 2)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} pointerEvents="none">
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.chart1} stopOpacity={0.32} />
              <Stop offset="1" stopColor={theme.chart1} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill="url(#areaFill)" />
          <Path d={line} stroke={theme.chart1} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {last ? <Circle cx={Math.min(width - 4, last[0])} cy={last[1]} r={4} fill={theme.chart1} stroke={theme.background} strokeWidth={2} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** 묶음 막대(날짜별 숫자를 count개 묶음으로 더함) — 마지막 묶음만 진하게, 막대 위 숫자 */
export function GroupedBars({ values, groups = 6, height = 72 }: { values: number[]; groups?: number; height?: number }) {
  const theme = useTheme();
  const size = Math.max(1, Math.ceil(values.length / groups));
  const sums: number[] = [];
  for (let i = 0; i < values.length; i += size) sums.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...sums);
  return (
    <View style={[styles.bars, { height: height + 18 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sums.map((sum, i) => (
        <View key={i} style={styles.barCol}>
          <ThemedText type="caption" themeColor="textSecondary">
            {sum}
          </ThemedText>
          <View style={[styles.bar, { height: Math.max(4, (sum / max) * height), backgroundColor: i === sums.length - 1 ? theme.chart1 : theme.tintSoft }]} />
        </View>
      ))}
    </View>
  );
}

export interface FlowStep {
  key: string;
  label: string;
  /** 막대 길이(양수) */
  value: number;
  /** 막대 위 글(예: −207) */
  display: string;
  /** 빼는 단계면 막대를 위에 띄움(그 아래 남는 금액 높이) */
  base?: number;
  highlight?: boolean;
}

/** 정산 흐름 막대(결제액 → 수수료 → 수수료 뺀 금액 → 소속사 몫) */
export function FlowBars({ steps, height = 120 }: { steps: FlowStep[]; height?: number }) {
  const theme = useTheme();
  const max = Math.max(1, ...steps.map((step) => step.value + (step.base ?? 0)));
  return (
    <View style={styles.flow}>
      <View style={[styles.flowBars, { height: height + 20 }]}>
        {steps.map((step) => (
          <View key={step.key} style={styles.flowCol}>
            <ThemedText type="captionBold" style={[styles.flowValue, { color: step.highlight ? theme.chart1 : theme.textSecondary }]} numberOfLines={1}>
              {step.display}
            </ThemedText>
            <View
              style={[
                styles.flowBar,
                { height: Math.max(3, (step.value / max) * height), backgroundColor: step.highlight ? theme.chart1 : step.base !== undefined ? `${theme.chart2}66` : theme.tintSoft },
              ]}
            />
            <View style={{ height: ((step.base ?? 0) / max) * height }} />
          </View>
        ))}
      </View>
      <View style={styles.flowLabels}>
        {steps.map((step) => (
          <ThemedText key={step.key} type="caption" themeColor="textTertiary" style={styles.flowLabel} numberOfLines={2}>
            {step.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

/** 넘겨 보는 카드 아래 점 */
export function PageDots({ count, index }: { count: number; index: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotOn, { backgroundColor: i === index ? theme.tint : theme.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { fontSize: 20, lineHeight: 24 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  bar: { width: '100%', borderRadius: 6 },
  flow: { gap: Spacing.one },
  flowBars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  flowCol: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', gap: 3 },
  flowBar: { borderRadius: 6 },
  flowValue: { textAlign: 'center' },
  flowLabels: { flexDirection: 'row', gap: Spacing.two },
  flowLabel: { flex: 1, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 16 },
});
