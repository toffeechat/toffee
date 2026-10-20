import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AdminButton, AdminChip, AdminMessage, AdminSection } from '@/components/admin-ui';
import { AdminDateField } from '@/components/admin-date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ApiError } from '@/lib/api-client';
import { Spacing } from '@/constants/theme';
import { formatBangkokDateTime, isUpcoming, parseBangkokDateTime } from '@/utils/release';
import { thaiToday } from '@/utils/stat-range';

/**
 * 공개 시각(2026-10-19 예약 오픈) — 아티스트·CP방·묶음 공통. 태국 시간으로 "2026-11-01 20:00". 비우고 저장하거나 [바로 공개]면 지금 공개.
 * 그 전엔 팬 화면에 "곧 공개" + 알림 받기, 시각이 되면 알림 받기 누른 팬에게 푸시. 스토어 상품은 그 전에 심사를 통과해 둬야 함.
 */
export function ReleaseSection({
  releaseAt,
  watchCount,
  saving,
  onSave,
  note,
}: {
  releaseAt: string | null;
  watchCount: number;
  saving: boolean;
  onSave: (releaseAt: string | null) => Promise<unknown>;
  note?: string;
}) {
  const [text, setText] = useState(releaseAt ? formatBangkokDateTime(releaseAt) : '');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const upcoming = isUpcoming(releaseAt);

  const save = async (value: string | null) => {
    const iso = value === null ? null : parseBangkokDateTime(value);
    if (value !== null && !iso) return setMessage({ text: '날짜와 시각을 골라 주세요(태국 시간).', error: true });
    try {
      await onSave(iso);
      if (iso === null) setText('');
      setMessage({ text: iso ? `${formatBangkokDateTime(iso)}(태국)에 공개돼요.` : '바로 공개했어요.' });
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : '저장하지 못했어요.', error: true });
    }
  };

  return (
    <AdminSection
      title="공개 시각(예약 오픈)"
      hint={`태국 시간으로 넣어요. 그 전엔 팬 화면에 "곧 공개" 카드와 [알림 받기]만 보이고 구독은 안 돼요. 시각이 되면 바로 열리고, 알림 받기를 누른 팬에게 푸시가 가요.${note ? ` ${note}` : ''}`}>
      <ThemedText type="small" themeColor={upcoming ? 'text' : 'textSecondary'}>
        {upcoming ? `공개 예정: ${formatBangkokDateTime(releaseAt!)}(태국)` : releaseAt ? `공개됨(${formatBangkokDateTime(releaseAt)} 태국)` : '공개 중(예약 없음)'} · 알림 신청{' '}
        {watchCount}명
      </ThemedText>
      <AdminDateField label="공개 시각(태국 시간)" value={text} onChange={setText} withTime min={thaiToday()} />
      <AdminMessage text={message?.text ?? null} error={message?.error} />
      <ThemedView style={styles.chips}>
        {upcoming ? <AdminChip label="예약 취소(바로 공개)" danger disabled={saving} onPress={() => void save(null)} /> : null}
      </ThemedView>
      <AdminButton label={saving ? '저장 중…' : '공개 시각 저장'} disabled={saving || !text.trim()} onPress={() => void save(text)} />
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
});
