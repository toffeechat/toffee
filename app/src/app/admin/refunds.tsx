import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminMessage } from '@/components/admin-ui';
import { useAdminRefunds, useCheckRefund, type AdminRefundEntry } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

// 운영자 화면은 운영자(한국어) 전용이라 의도적으로 다국어 처리 안 함
const REASON_LABELS: Record<AdminRefundEntry['reason'], string> = { STAR_IDLE: '아티스트 미발송', ACTOR_RETIRED: '활동 종료' };
const SOURCE_LABELS: Record<AdminRefundEntry['source'], string> = { SANDBOX: '테스트', APPLE: '애플', GOOGLE: '구글' };
type Filter = 'all' | AdminRefundEntry['reason'] | 'waiting';
// 처리 대기(2026-10-22) — 애플 안내 뒤 며칠이 지나도 환불이 안 된 건. 운영자 홈 "처리할 일" 카드에서 바로 이 탭으로 옴
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'waiting', label: '처리 대기' },
  { value: 'STAR_IDLE', label: '아티스트 미발송' },
  { value: 'ACTOR_RETIRED', label: '활동 종료' },
];
const matches = (row: AdminRefundEntry, filter: Filter) => filter === 'all' || (filter === 'waiting' ? row.waiting : row.reason === filter);

const money = (cents: number) => `฿${(cents / 100).toLocaleString('ko-KR')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

/** 상태 — 우리가 환불 완료 / 애플 안내 후 애플이 환불함 / 애플 안내만(팬이 아직 안 했거나 애플이 거절) */
function statusOf(entry: AdminRefundEntry): { label: string; done: boolean } {
  if (entry.status === 'REFUNDED') return { label: '환불 완료', done: true };
  if (entry.refundedAt) return { label: '애플 환불 완료', done: true };
  if (entry.waiting) return { label: '처리 대기 · 애플 안내 후 환불 안 됨', done: false };
  return entry.checkedAt ? { label: '운영자 확인함 · 환불 안 됨', done: false } : { label: '애플 안내함 · 아직 환불 안 됨', done: false };
}

/**
 * 환불 요청 목록(2026-09-29) — 최근 200건. 고객 문의("환불 요청했는데요") 대응, 애플 안내 건이 실제로 환불됐는지, 어느 배우·소속사에서
 * 환불이 자주 나오는지(계약 대화 근거). 환불된 금액은 정산에서 자동으로 빠짐.
 */
export default function AdminRefundsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>(params.filter === 'waiting' ? 'waiting' : 'all');
  // 전부 받아서 화면에서 거름 — 탭 옆 개수(2026-10-20)
  const { data, isLoading } = useAdminRefunds();
  const rows = (data ?? []).filter((row) => matches(row, filter));
  const countOf = (value: Filter) => (data ?? []).filter((row) => matches(row, value)).length;
  const refundedCents = rows.filter((row) => statusOf(row).done).reduce((sum, row) => sum + row.amountCents, 0);
  const waiting = rows.filter((row) => !statusOf(row).done).length;

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.chips}>
            {FILTERS.map((option) => {
              const selected = filter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setFilter(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                  <ThemedText type="smallMedium" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {data ? `${option.label} (${countOf(option.value)})` : option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {rows.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {rows.length}건 · 환불된 금액 {money(refundedCents)}
              {waiting > 0 ? ` · 애플 안내 후 아직 환불 안 됨 ${waiting}건` : ''}
            </ThemedText>
          ) : null}
          {filter === 'waiting' ? (
            <ThemedText type="small" themeColor="textSecondary">
              애플은 우리가 환불할 수 없어서 팬에게 애플 환불 페이지를 안내만 해요. 며칠이 지나도 환불이 안 됐으면 팬에게 애플에 요청했는지·거절됐는지 확인하고 [확인함]을
              눌러 주세요. 애플이 나중에 환불하면 결제 기록은 자동으로 환불로 바뀌어요.
            </ThemedText>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={theme.tint} style={styles.loading} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {filter === 'waiting' ? '처리 대기 중인 환불이 없어요.' : '아직 환불 요청이 없어요.'}
          </ThemedText>
        )
      }
      renderItem={({ item }) => {
        const status = statusOf(item);
        const agencies = item.agencies.map((name) => name ?? '무소속').join(', ');
        return (
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.top}>
              <ThemedText type="smallBold">
                {REASON_LABELS[item.reason]} · {item.productName} · {money(item.amountCents)}
              </ThemedText>
              <ThemedText type="captionBold" style={{ color: status.done ? theme.tint : theme.danger }}>
                {status.label}
              </ThemedText>
            </View>
            <ThemedText type="small">
              팬: {item.fan ? `${item.fan.name}${item.fan.email ? ` (${item.fan.email})` : ''}` : '탈퇴한 회원'} · {SOURCE_LABELS[item.source]} 결제
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              아티스트 {item.actors.join(', ')} · {agencies} · 이용 기간 {day(item.chargedAt)} ~ {day(new Date(new Date(item.periodEnd).getTime() - 1).toISOString())}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              요청 {new Date(item.requestedAt).toLocaleString('ko-KR')}
              {item.refundedAt ? ` · 환불 ${new Date(item.refundedAt).toLocaleString('ko-KR')}` : ''}
            </ThemedText>
            {item.checkedAt ? (
              <ThemedText type="caption" themeColor="textSecondary">
                확인함 {new Date(item.checkedAt).toLocaleString('ko-KR')}
                {item.checkedBy ? ` · ${item.checkedBy}` : ''}
                {item.checkedNote ? ` · 메모: ${item.checkedNote}` : ''}
              </ThemedText>
            ) : null}
            {item.waiting ? <CheckForm id={item.id} /> : null}
          </View>
        );
      }}
    />
  );
}

/** 처리 대기 건 정리 — 메모(선택, 예: 팬이 애플에 요청 안 함 / 애플이 거절) + [확인함] */
function CheckForm({ id }: { id: string }) {
  const theme = useTheme();
  const check = useCheckRefund();
  const [note, setNote] = useState('');
  return (
    <View style={styles.check}>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="메모(선택) — 예: 팬이 애플에 요청 안 함, 애플이 거절"
        placeholderTextColor={theme.textSecondary}
        maxLength={500}
        style={[styles.note, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
      />
      <AdminButtonRow>
        <AdminButton secondary label={check.isPending ? '저장 중…' : '확인함'} disabled={check.isPending} onPress={() => check.mutate({ id, note: note.trim() || undefined })} />
      </AdminButtonRow>
      <AdminMessage text={check.isError ? (check.error instanceof ApiError ? check.error.message : '저장하지 못했어요.') : null} error />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: 900, alignSelf: 'center' },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: Radius.pill },
  loading: { marginTop: Spacing.six },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  row: { borderRadius: Radius.md, padding: Spacing.three, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  check: { gap: Spacing.one, marginTop: Spacing.one },
  note: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 14 },
});
