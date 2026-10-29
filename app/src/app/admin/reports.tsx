import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip, AdminMessage, AdminSection } from '@/components/admin-ui';
import { AdminDateField } from '@/components/admin-date-field';
import {
  useAdminAgencies,
  useAdminReports,
  useDismissReport,
  useResolveReport,
  type AdminReport,
  type AdminReportFilter,
  type ReportStatus,
} from '@/hooks/use-admin';
import { useMe } from '@/hooks/use-onboarding';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { showNameToken } from '@/utils/name-token';
import { thaiToday } from '@/utils/stat-range';

// 운영자 화면은 한국어 전용(운영자 본인용)
const CATEGORY_LABELS: Record<string, string> = {
  SPAM: '스팸·광고',
  ABUSE: '욕설·괴롭힘',
  SEXUAL: '음란·성적',
  PRIVACY: '개인정보 노출',
  OTHER: '기타',
};
const STATUS_CARDS: { key: ReportStatus | null; label: string; hint: string }[] = [
  { key: null, label: '전체', hint: '모든 신고' },
  { key: 'PENDING', label: '처리 대기', hint: '아직 안 본 것' },
  { key: 'RESOLVED', label: '승인', hint: '메시지를 가림' },
  { key: 'DISMISSED', label: '기각', hint: '문제 없음' },
];
const STATUS_LABEL: Record<ReportStatus, string> = { PENDING: '처리 대기', RESOLVED: '승인(가림)', DISMISSED: '기각' };
const ROLE_LABELS: Record<string, string> = { USER: '팬', ACTOR: '아티스트', AGENCY_STAFF: '소속사', ADMIN: '운영자' };

/**
 * 신고 처리(2026-10-20 개편: 사용자 요청 "소속사·아티스트별로, 총·승인·기각을 한눈에, 카드를 누르면 그만큼 필터") — 위에 상태별 카드(누르면 그 상태만),
 * 사유·소속사·기간 필터, 신고 많은 방(누르면 그 방만), 아래 목록(처리한 것도). 팬 답장 신고는 [이 팬 제재하기]로 회원 상세에 바로.
 */
export default function AdminReportsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<AdminReportFilter>({ status: 'PENDING' });
  const { data, isLoading, isFetching } = useAdminReports(filter);
  // 소속사 목록은 전체 권한 전용 API(2026-10-29 — SUPPORT 운영자는 부르지 않음, 소속사 거르기 칩도 안 보임)
  const { data: me } = useMe();
  const { data: agencies } = useAdminAgencies(!!me && me.adminLevel !== 'SUPPORT');
  const set = (patch: Partial<AdminReportFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const selectedActor = data?.byActor.find((row) => row.actorId === filter.actorId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => `${item.id}-${item.status}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.cards}>
              {STATUS_CARDS.map((card) => {
                const selected = (filter.status ?? null) === card.key;
                const count = data ? data.counts[card.key ?? 'ALL'] : null;
                return (
                  <Pressable
                    key={card.label}
                    onPress={() => set({ status: card.key ?? undefined })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.card,
                      { backgroundColor: selected ? theme.tintSoft : theme.backgroundElement, borderColor: selected ? theme.tint : 'transparent' },
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {card.label}
                    </ThemedText>
                    <ThemedText type="title" themeColor={card.key === 'PENDING' && count ? 'danger' : 'text'}>
                      {count ?? '–'}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textTertiary">
                      {card.hint}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <AdminSection title="필터" hint="카드 숫자는 아래 필터를 건 결과예요.">
              <ThemedText type="small" themeColor="textSecondary">
                사유
              </ThemedText>
              <View style={styles.chips}>
                <AdminChip label="모든 사유" selected={!filter.category} onPress={() => set({ category: undefined })} />
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <AdminChip key={key} label={label} selected={filter.category === key} onPress={() => set({ category: key })} />
                ))}
              </View>
              {agencies?.length ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    소속사(CP방은 멤버 소속사)
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>
                    <AdminChip label="모든 소속사" selected={!filter.agencyId} onPress={() => set({ agencyId: undefined, actorId: undefined })} />
                    {agencies.map((agency) => (
                      <AdminChip key={agency.id} label={agency.name} selected={filter.agencyId === agency.id} onPress={() => set({ agencyId: agency.id, actorId: undefined })} />
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <View style={styles.dates}>
                <View style={styles.dateCell}>
                  <AdminDateField label="시작일(태국)" value={filter.from ?? ''} onChange={(from) => set({ from: from || undefined })} max={filter.to ?? thaiToday()} clearable />
                </View>
                <View style={styles.dateCell}>
                  <AdminDateField label="끝날(태국)" value={filter.to ?? ''} onChange={(to) => set({ to: to || undefined })} min={filter.from} max={thaiToday()} clearable />
                </View>
              </View>
            </AdminSection>

            {data?.byActor.length ? (
              <AdminSection title="신고 많은 방" hint="누르면 그 방 신고만 봐요.">
                <View style={styles.chips}>
                  {filter.actorId ? <AdminChip label="모든 방" onPress={() => set({ actorId: undefined })} /> : null}
                  {(selectedActor ? [selectedActor] : data.byActor).map((row) => (
                    <AdminChip key={row.actorId} label={row.name} count={row.count} selected={filter.actorId === row.actorId} onPress={() => set({ actorId: row.actorId })} />
                  ))}
                </View>
              </AdminSection>
            ) : null}
            {isLoading || isFetching ? <ActivityIndicator color={theme.tint} /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {filter.status === 'PENDING' ? '대기 중인 신고가 없어요.' : '조건에 맞는 신고가 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => <ReportRow report={item} />}
      />
    </SafeAreaView>
  );
}

function ReportRow({ report }: { report: AdminReport }) {
  const theme = useTheme();
  const router = useRouter();
  const resolve = useResolveReport();
  const dismiss = useDismissReport();
  const isPending = resolve.isPending || dismiss.isPending;
  // 승인·기각 실패도 보여 줌(2026-10-29 — 예전엔 실패해도 아무 표시 없었음)
  const [error, setError] = useState<string | null>(null);
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : '처리하지 못했어요.');
  const fromFan = report.message.senderType === 'FAN';
  const actor = report.message.actor;

  const onResolve = async () => {
    const what = fromFan ? '이 팬 답장을 아티스트·소속사 화면에서 가려요.' : '이 아티스트 메시지를 팬 화면에서 가려요.';
    if (await confirm('신고 승인', `${what} 같은 메시지의 대기 중 신고 ${report.reportCount}건이 함께 처리돼요.`, '승인', '취소')) resolve.mutate(report.id, { onSuccess: () => setError(null), onError });
  };
  const onDismiss = async () => {
    if (await confirm('신고 기각', `문제 없음으로 처리해요(메시지는 그대로). 같은 메시지의 대기 중 신고 ${report.reportCount}건이 함께 처리돼요.`, '기각', '취소')) dismiss.mutate(report.id, { onSuccess: () => setError(null), onError });
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.rowHead}>
        <ThemedText type="smallBold" style={styles.flex}>
          {report.reportCount > 1 ? `${report.reportCount}명이 신고 · ` : ''}
          {report.categories.map((category) => CATEGORY_LABELS[category] ?? category).join(', ')}
        </ThemedText>
        <ThemedText type="small" themeColor={report.status === 'PENDING' ? 'danger' : 'textSecondary'}>
          {STATUS_LABEL[report.status]}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {actor.chatDisplayName}
        {actor.kind === 'COUPLE' ? ' [CP]' : ''} · 공식 이름 {actor.legalName} · {actor.agencyNames.length ? actor.agencyNames.join(', ') : '무소속'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {fromFan
          ? `팬 답장 — ${report.message.fanUser?.nickname ?? '(닉네임 없음)'} / ${report.message.fanUser?.displayName ?? '탈퇴한 팬'}${
              report.message.fanUser && report.message.fanUser.status !== 'ACTIVE' ? ` · ${report.message.fanUser.status === 'BANNED' ? '영구차단됨' : '정지 중'}` : ''
            }`
          : '아티스트 메시지'}
      </ThemedText>
      {report.message.body ? <ThemedText type="small">신고된 메시지: {showNameToken(report.message.body, '팬 닉네임')}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        첫 신고: {report.reportedBy.nickname ?? report.reportedBy.displayName}({ROLE_LABELS[report.reportedBy.role] ?? report.reportedBy.role})
        {report.reason ? ` — ${report.reason}` : ''} · {new Date(report.createdAt).toLocaleString('ko-KR')}
        {report.resolvedAt ? ` · 처리 ${new Date(report.resolvedAt).toLocaleString('ko-KR')}` : ''}
      </ThemedText>
      <AdminMessage text={error} error />
      <AdminButtonRow>
        {report.status === 'PENDING' ? (
          <>
            <AdminButton label={fromFan ? '승인(답장 가리기)' : '승인(팬 화면에서 가리기)'} disabled={isPending} onPress={() => void onResolve()} />
            <AdminButton secondary label="기각" disabled={isPending} onPress={() => void onDismiss()} />
          </>
        ) : null}
        {fromFan && report.message.fanUser ? (
          <AdminButton secondary label="이 팬 제재하기" onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: report.message.fanUser!.id } })} />
        ) : null}
        <AdminButton secondary label="토피룸 보기" onPress={() => router.push(`/console/${report.message.actorId}`)} />
      </AdminButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.three },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { flexGrow: 1, flexBasis: 140, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipLine: { flexDirection: 'row', gap: Spacing.two },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  dateCell: { flexGrow: 1, flexBasis: 200 },
  row: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
});
