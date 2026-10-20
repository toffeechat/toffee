import { type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PersonFigure } from '@/components/ui/person-figure';
import { useTheme } from '@/hooks/use-theme';
import { useWideLayout } from '@/components/wide-shell';
import { Spacing } from '@/constants/theme';

// 운영자 화면 공용 조각 — 운영자 화면은 한국어 전용(다국어 대상 아님)

export function AdminSection({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {children}
    </ThemedView>
  );
}

export function AdminField({ label, ...input }: { label: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
      />
    </ThemedView>
  );
}

/** 칩·탭 — count를 주면 "전체 (33)"처럼 개수를 붙임(2026-10-20 사용자 요청: 탭마다 기본으로 개수) */
export function AdminChip({
  label,
  count,
  selected,
  danger,
  disabled,
  onPress,
}: {
  label: string;
  count?: number;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.tint;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? color : theme.backgroundSelected, backgroundColor: selected ? color : 'transparent' },
        disabled && styles.disabled,
      ]}>
      <ThemedText type="small" style={selected ? styles.chipSelectedText : danger ? { color: theme.danger } : undefined}>
        {count === undefined ? label : `${label} (${count.toLocaleString()})`}
      </ThemedText>
    </Pressable>
  );
}

/**
 * 운영자 기본 버튼 — 폰에선 화면 폭 가득, PC 웹 넓은 화면에선 글자 길이만큼(2026-10-20 사용자 피드백: "웹에선 버튼이 화면 한 폭으로 타이트해서
 * 안 예쁨"). secondary는 테두리만(한 화면에 버튼이 여럿일 때 주 버튼 하나만 색칠)
 */
export function AdminButton({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const theme = useTheme();
  const wide = useWideLayout();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }) => [
        styles.button,
        secondary ? { borderWidth: 1, borderColor: theme.tint, backgroundColor: hovered ? theme.tintSoft : 'transparent' } : { backgroundColor: theme.tint, opacity: hovered ? 0.9 : 1 },
        wide && styles.buttonWide,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="smallBold" style={secondary ? { color: theme.tint } : styles.chipSelectedText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 버튼 여러 개를 한 줄로(좁으면 다음 줄로) — 목록 화면 위쪽 "등록" 버튼들 */
export function AdminButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

export function AdminMessage({ text, error }: { text: string | null; error?: boolean }) {
  if (!text) return null;
  return (
    <ThemedText type="small" themeColor={error ? 'danger' : 'textSecondary'}>
      {text}
    </ThemedText>
  );
}

/** 아티스트 성별 선택지(2026-10-02, 둘러보기 여성·남성 줄) — null은 지정 안 함(그룹·혼성 등, 두 줄엔 안 나옴) */
export const GENDER_OPTIONS: { value: 'FEMALE' | 'MALE' | null; label: string }[] = [
  { value: 'FEMALE', label: '여성' },
  { value: 'MALE', label: '남성' },
  { value: null, label: '지정 안 함' },
];

/**
 * 정사각 썸네일 — 사진이 없으면 사람 모양 기본 프로필(앱 Avatar와 같음, 2026-10-02).
 * 소속사 로고처럼 사람이 아닌 것은 org로 — 이름 첫 글자.
 */
export function AdminAvatar({ uri, name, size = 48, org }: { uri: string | null; name: string; size?: number; org?: boolean }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 4 };
  if (uri) return <Image source={{ uri }} style={[box, { backgroundColor: theme.backgroundSelected }]} />;
  if (!org) {
    return (
      <View style={[box, { overflow: 'hidden' }]}>
        <PersonFigure width={size} />
      </View>
    );
  }
  return (
    <ThemedView style={[box, styles.avatarFallback, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold">{name.trim().charAt(0)}</ThemedText>
    </ThemedView>
  );
}

/** 사진 한 장 고르기 — 프로필은 정사각으로 자르게 함. 취소하면 null */
export async function pickSquarePhoto(): Promise<{ uri: string; contentType?: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, contentType: asset.mimeType } : null;
}

export function formatBaht(cents: number) {
  return `฿${(cents / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`;
}

/** "129" / "129.50" → 12900 / 12950, 잘못된 입력이면 null */
export function parseBahtToCents(text: string): number | null {
  const trimmed = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

const styles = StyleSheet.create({
  section: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  field: { gap: 4, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 6 },
  chipSelectedText: { color: '#fff' },
  button: { borderRadius: 10, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three, alignItems: 'center' },
  buttonWide: { alignSelf: 'flex-start', minWidth: 160, paddingHorizontal: Spacing.four },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  disabled: { opacity: 0.5 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
});
