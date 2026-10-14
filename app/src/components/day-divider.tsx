import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/** 같은 날인지 — 날짜 구분선·묶음 기준(기기 시간대) */
export const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * 대화창 날짜 구분선(2026-10-14 사용자 요청) — "──── 2026년 1월 1일 목요일 ────". 팬·아티스트·소속사 모든 대화창 공통이고,
 * 메시지 옆엔 시간만(예전 아티스트·소속사 화면은 말풍선마다 "10월 11일 / 오전 4:22" 두 줄)
 */
export function DayDivider({ iso }: { iso: string }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.line, { backgroundColor: theme.border }]} />
      <ThemedText type="caption" themeColor="textTertiary">
        {new Date(iso).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </ThemedText>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.three },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
