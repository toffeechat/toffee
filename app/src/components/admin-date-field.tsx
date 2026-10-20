import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { monthGrid, thaiToday } from '@/utils/stat-range';

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = ['00', '10', '15', '20', '30', '40', '45', '50'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 운영자 날짜(·시각) 입력(2026-10-20 사용자 요청: "기본 입력칸 말고 날짜 형태로") — 누르면 달력(+ 시·분)이 뜸. 값은 예전 입력칸과 같은 글자
 * "YYYY-MM-DD" / "YYYY-MM-DD HH:mm"이라 부르는 쪽 검사(parseBangkokDateTime 등)는 그대로. 시간대는 label에 적음(공개 시각은 태국, 데모 만료일은 한국 등).
 * min/max는 고를 수 있는 날(YYYY-MM-DD, 양 끝 포함).
 */
export function AdminDateField({
  label,
  value,
  onChange,
  withTime,
  min,
  max,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  min?: string;
  max?: string;
  clearable?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value || '고르기'}`}
        style={[styles.box, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <Icon as={CalendarDays} size={18} color={theme.textSecondary} />
        <ThemedText style={[styles.boxText, !value && { color: theme.textTertiary }]}>{value || (withTime ? '날짜·시각 고르기' : '날짜 고르기')}</ThemedText>
      </Pressable>
      {open ? (
        <DatePickerModal
          initial={value}
          withTime={withTime}
          min={min}
          max={max}
          clearable={clearable}
          onClose={() => setOpen(false)}
          onApply={(next) => {
            setOpen(false);
            onChange(next);
          }}
        />
      ) : null}
    </View>
  );
}

function DatePickerModal({
  initial,
  withTime,
  min,
  max,
  clearable,
  onClose,
  onApply,
}: {
  initial: string;
  withTime?: boolean;
  min?: string;
  max?: string;
  clearable?: boolean;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const theme = useTheme();
  const parsed = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(initial.trim());
  const [day, setDay] = useState<string | null>(parsed?.[1] ?? null);
  const [hour, setHour] = useState(parsed?.[2] ?? '20');
  const [minute, setMinute] = useState(parsed?.[3] ?? '00');
  const shown = (day ?? min ?? thaiToday()).split('-').map(Number);
  const [cursor, setCursor] = useState({ year: shown[0], month: shown[1] });
  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  const enabled = (cell: string) => (!min || cell >= min) && (!max || cell <= max);
  const result = day ? (withTime ? `${day} ${hour}:${minute}` : day) : '';

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기">
        <Pressable style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.monthBar}>
              <IconButton icon={ChevronLeft} label="이전 달" onPress={() => move(-1)} />
              <ThemedText type="smallBold">{`${cursor.year}년 ${cursor.month}월`}</ThemedText>
              <IconButton icon={ChevronRight} label="다음 달" onPress={() => move(1)} />
            </View>
            <View style={styles.grid}>
              {WEEKDAYS.map((name) => (
                <ThemedText key={name} type="caption" themeColor="textTertiary" style={styles.cell}>
                  {name}
                </ThemedText>
              ))}
              {monthGrid(cursor.year, cursor.month).map((cell, i) => {
                if (!cell) return <View key={`e${i}`} style={styles.cell} />;
                const ok = enabled(cell);
                const selected = cell === day;
                return (
                  <Pressable
                    key={cell}
                    onPress={() => setDay(cell)}
                    disabled={!ok}
                    accessibilityRole="button"
                    accessibilityLabel={cell}
                    accessibilityState={{ selected, disabled: !ok }}
                    style={styles.cell}>
                    <View style={[styles.dayCircle, selected && { backgroundColor: theme.tint }]}>
                      <ThemedText type={selected ? 'smallBold' : 'small'} style={{ color: selected ? '#fff' : theme.text, opacity: ok ? 1 : 0.3 }}>
                        {Number(cell.slice(8))}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {withTime ? (
              <>
                <ThemedText type="smallBold">시</ThemedText>
                <View style={styles.chips}>
                  {HOURS.map((value) => (
                    <TimeChip key={value} label={value} selected={hour === value} onPress={() => setHour(value)} />
                  ))}
                </View>
                <ThemedText type="smallBold">분</ThemedText>
                <View style={styles.chips}>
                  {MINUTES.map((value) => (
                    <TimeChip key={value} label={value} selected={minute === value} onPress={() => setMinute(value)} />
                  ))}
                </View>
              </>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
              {result || '날짜를 골라 주세요'}
            </ThemedText>
            <View style={styles.actions}>
              {clearable ? (
                <Pressable onPress={() => onApply('')} accessibilityRole="button" style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}>
                  <ThemedText type="smallBold" themeColor="danger">
                    비우기
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} accessibilityRole="button" style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText type="smallBold">취소</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => result && onApply(result)}
                disabled={!result}
                accessibilityRole="button"
                style={[styles.action, { backgroundColor: theme.primary, opacity: result ? 1 : 0.4 }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  적용
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimeChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.timeChip, { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? theme.tint : 'transparent' }]}>
      <ThemedText type="small" style={{ color: selected ? '#fff' : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  boxText: { fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,21,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '90%', borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth },
  sheetContent: { padding: Spacing.three, gap: Spacing.two },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: { borderWidth: 1, borderRadius: 8, minWidth: 40, paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center' },
  summary: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  action: { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
