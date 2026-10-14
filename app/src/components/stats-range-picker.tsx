import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { STATS_PERIODS, type StatsSelection } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_RANGE_DAYS, monthGrid, presetRange, selectable, spanDays, thaiToday } from '@/utils/stat-range';

/** YYYY-MM-DD → "8월 1일"(올해가 아니면 연도까지) */
export function formatStatDay(day: string, language: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const sameYear = y === Number(thaiToday().slice(0, 4));
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(language, {
    ...(sameYear ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * 통계 기간 고르기(2026-10-13 사용자 요청: 최대 90일 → 원하는 기간, 최대 1년) — [7일][30일][90일] 빠른 버튼 + [기간 선택](달력).
 * 직접 고른 기간이면 마지막 버튼에 "8월 1일 ~ 9월 15일".
 */
export function StatsRangeControl({ value, onChange }: { value: StatsSelection; onChange: (value: StatsSelection) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const custom = !('days' in value);
  const pill = (selected: boolean) => [styles.pill, selected && [styles.pillSelected, { backgroundColor: theme.background }]];
  return (
    <>
      <View style={[styles.pills, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
        {STATS_PERIODS.map((days) => {
          const selected = 'days' in value && value.days === days;
          return (
            <Pressable key={days} onPress={() => onChange({ days })} accessibilityRole="tab" accessibilityState={{ selected }} style={pill(selected)}>
              <ThemedText type={selected ? 'smallBold' : 'smallMedium'} themeColor={selected ? 'text' : 'textSecondary'}>
                {t('dashboard.period', { days })}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setOpen(true)} accessibilityRole="tab" accessibilityState={{ selected: custom }} style={[pill(custom), styles.customPill]}>
          <Icon as={CalendarRange} size={14} color={custom ? theme.text : theme.textSecondary} />
          <ThemedText type={custom ? 'smallBold' : 'smallMedium'} themeColor={custom ? 'text' : 'textSecondary'} numberOfLines={1}>
            {custom ? `${formatStatDay(value.from, i18n.language)} ~ ${formatStatDay(value.to, i18n.language)}` : t('dashboard.custom')}
          </ThemedText>
        </Pressable>
      </View>
      {open ? (
        <RangeCalendarModal
          initial={custom ? value : null}
          onClose={() => setOpen(false)}
          onApply={(range) => {
            setOpen(false);
            onChange(range);
          }}
        />
      ) : null}
    </>
  );
}

function RangeCalendarModal({
  initial,
  onClose,
  onApply,
}: {
  initial: { from: string; to: string } | null;
  onClose: () => void;
  onApply: (range: { from: string; to: string }) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const today = thaiToday();
  const [start, setStart] = useState<string | null>(initial?.from ?? null);
  const [end, setEnd] = useState<string | null>(initial?.to ?? null);
  const shown = (initial?.to ?? today).split('-').map(Number);
  const [cursor, setCursor] = useState({ year: shown[0], month: shown[1] });

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  const atCurrentMonth = cursor.year * 12 + cursor.month >= Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));

  // 첫 번째 누름 = 시작, 두 번째 = 끝(시작보다 앞이면 시작을 바꿈), 둘 다 고른 뒤 다시 누르면 새로 시작
  const pick = (day: string) => {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  };
  const applyPreset = (preset: 'thisMonth' | 'lastMonth' | 'lastYear') => {
    const range = presetRange(preset, today);
    setStart(range.from);
    setEnd(range.to);
    const [y, m] = range.to.split('-').map(Number);
    setCursor({ year: y, month: m });
  };

  const monthTitle = new Date(Date.UTC(cursor.year, cursor.month - 1, 15)).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', timeZone: 'UTC' });
  // 일요일 시작 요일 이름(2026-10-04는 일요일)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 9, 4 + i, 12)).toLocaleDateString(i18n.language, { weekday: 'narrow', timeZone: 'UTC' }),
  );
  const rangeEnd = end ?? start;
  const summary =
    start && rangeEnd
      ? t('dashboard.picker.selected', {
          from: formatStatDay(start, i18n.language),
          to: formatStatDay(rangeEnd, i18n.language),
          days: spanDays(start, rangeEnd),
        })
      : t('dashboard.picker.hint', { days: MAX_RANGE_DAYS });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => {}}>
          <ThemedText type="headline">{t('dashboard.picker.title')}</ThemedText>
          <View style={styles.presets}>
            {(['thisMonth', 'lastMonth', 'lastYear'] as const).map((preset) => (
              <Pressable key={preset} onPress={() => applyPreset(preset)} accessibilityRole="button" style={[styles.preset, { borderColor: theme.border }]}>
                <ThemedText type="smallMedium">{t(`dashboard.picker.${preset}`)}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.monthBar}>
            <IconButton icon={ChevronLeft} label={t('dashboard.picker.prevMonth')} onPress={() => move(-1)} />
            <ThemedText type="smallBold">{monthTitle}</ThemedText>
            <IconButton icon={ChevronRight} label={t('dashboard.picker.nextMonth')} onPress={() => move(1)} disabled={atCurrentMonth} />
          </View>
          <View style={styles.grid}>
            {weekdays.map((name, i) => (
              <ThemedText key={`w${i}`} type="caption" themeColor="textTertiary" style={styles.cell}>
                {name}
              </ThemedText>
            ))}
            {monthGrid(cursor.year, cursor.month).map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.cell} />;
              const enabled = selectable(day, today, start && !end ? start : null);
              const edge = day === start || day === rangeEnd;
              const inside = !!start && !!rangeEnd && day > start && day < rangeEnd;
              return (
                <Pressable
                  key={day}
                  onPress={() => pick(day)}
                  disabled={!enabled}
                  accessibilityRole="button"
                  accessibilityLabel={formatStatDay(day, i18n.language)}
                  accessibilityState={{ selected: edge || inside, disabled: !enabled }}
                  style={[styles.cell, inside && { backgroundColor: theme.tintSoft }]}>
                  <View style={[styles.dayCircle, edge && { backgroundColor: theme.tint }]}>
                    <ThemedText
                      type={edge ? 'smallBold' : 'small'}
                      style={{ color: edge ? '#fff' : enabled ? theme.text : theme.textTertiary, opacity: enabled ? 1 : 0.4 }}>
                      {Number(day.slice(8))}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
            {summary}
          </ThemedText>
          <View style={styles.actions}>
            <Pressable onPress={onClose} accessibilityRole="button" style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}>
              <ThemedText type="smallBold">{t('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => start && onApply({ from: start, to: end ?? start })}
              disabled={!start}
              accessibilityRole="button"
              style={[styles.action, { backgroundColor: theme.primary, opacity: start ? 1 : 0.4 }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {t('dashboard.picker.apply')}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: Radius.lg, padding: 3, gap: 2, alignSelf: 'flex-start' },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
  customPill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 260 },
  pillSelected: { shadowColor: '#0F1115', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,21,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  sheet: { width: '100%', maxWidth: 380, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  preset: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 4 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  summary: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  action: { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
