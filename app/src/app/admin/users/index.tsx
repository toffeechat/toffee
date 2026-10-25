import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip } from '@/components/admin-ui';
import { ROLE_LABELS, statusText, timeAgo } from '@/components/admin-user-panels';
import { useWideLayout } from '@/components/wide-shell';
import { StatsRangeControl, selectionLabel } from '@/components/stats-range-picker';
import { useAdminUsers, type AdminUser, type AdminUserPeriod, type AdminUserSort } from '@/hooks/use-admin';
import { selectionFromParams, type StatsSelection } from '@/hooks/use-console';
import { thaiToday } from '@/utils/stat-range';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const ROLE_FILTERS: (AdminUser['role'] | null)[] = [null, 'USER', 'ACTOR', 'AGENCY_STAFF', 'ADMIN'];
const PERIOD_FIELDS: { value: AdminUserPeriod['field'] | null; label: string }[] = [
  { value: null, label: '기간 전체' },
  { value: 'joined', label: '가입일' },
  { value: 'active', label: '최근 접속' },
];

type Params = { role?: string; sort?: string; dateField?: string; days?: string; from?: string; to?: string };

/** 주소 값 → 기간 필터(운영자 홈 "오늘 가입·오늘 접속" 카드가 dateField·from·to 또는 days를 넘김) */
function periodFromParams(params: Params): AdminUserPeriod | null {
  if (params.dateField !== 'joined' && params.dateField !== 'active') return null;
  return { field: params.dateField, selection: selectionFromParams(params) };
}

function periodText(period: AdminUserPeriod, language: string) {
  return `${selectionLabel(period.selection, language)}${period.field === 'joined' ? ' 가입한' : ' 마지막으로 접속한'} 회원 — 태국 시간 기준, 탈퇴한 계정은 빠져요`;
}

/**
 * 회원 관리(2026-10-20 개편: 사용자 피드백 "회원 카드가 한눈에 안 들어옴") — PC는 표(이름·역할·소속·상태·마지막 접속·가입일), 폰은 두 줄 목록.
 * 줄을 누르면 회원 상세(역할·소속사·제재·접속 기록). 역할 탭 옆에 인원수, 한 쪽 50명씩.
 * 기간 필터(2026-10-25) — 가입일·최근 접속이 그 기간(통계와 같은 태국 날짜·기간 고르기). 운영자 홈 "오늘 가입 54"를 누르면 팬 + 오늘 가입으로 열림.
 */
export default function AdminUsersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const wide = useWideLayout();
  const { i18n } = useTranslation();
  const params = useLocalSearchParams<Params>();
  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AdminUser['role'] | null>(() => ROLE_FILTERS.find((value) => value && value === params.role) ?? null);
  const [sort, setSort] = useState<AdminUserSort | undefined>(params.sort === 'recent' ? 'recent' : undefined);
  const [period, setPeriod] = useState<AdminUserPeriod | null>(() => periodFromParams(params));
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAdminUsers(query.trim(), role ?? undefined, sort, page, period);
  const today = thaiToday();
  const isToday = !!period && !('days' in period.selection) && period.selection.from === today && period.selection.to === today;
  const changePeriod = reset(setPeriod);
  const pickField = (field: AdminUserPeriod['field'] | null) =>
    changePeriod(field ? { field, selection: period?.selection ?? { from: today, to: today } } : null);
  const pickSelection = (selection: StatsSelection) => period && changePeriod({ ...period, selection });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const open = (user: AdminUser) => router.push({ pathname: '/admin/users/[id]', params: { id: user.id } });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={reset(setQuery)}
              placeholder="이름·닉네임·이메일로 검색"
              placeholderTextColor={theme.textSecondary}
              style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <View style={styles.chips}>
              {ROLE_FILTERS.map((value) => (
                <AdminChip
                  key={value ?? 'ALL'}
                  label={value ? ROLE_LABELS[value] : '전체'}
                  count={data?.counts[value ?? 'ALL']}
                  selected={role === value}
                  onPress={() => reset(setRole)(value)}
                />
              ))}
            </View>
            {/* 예) 소속사 직원 + 최근 접속순으로 데모를 받은 소속사가 들어와 봤는지 확인 */}
            <View style={styles.chips}>
              <AdminChip label="가입 최신순" selected={!sort} onPress={() => reset(setSort)(undefined)} />
              <AdminChip label="최근 접속순" selected={sort === 'recent'} onPress={() => reset(setSort)('recent')} />
              {isFetching ? <ActivityIndicator color={theme.tint} /> : null}
            </View>
            <View style={styles.chips}>
              {PERIOD_FIELDS.map((item) => (
                <AdminChip key={item.value ?? 'ALL'} label={item.label} selected={(period?.field ?? null) === item.value} onPress={() => pickField(item.value)} />
              ))}
            </View>
            {period ? (
              <>
                <View style={styles.chips}>
                  <AdminChip label="오늘" selected={isToday} onPress={() => pickSelection({ from: today, to: today })} />
                  <StatsRangeControl value={period.selection} onChange={pickSelection} />
                </View>
                <ThemedText type="caption" themeColor="textSecondary">
                  {periodText(period, i18n.language)}
                </ThemedText>
              </>
            ) : null}
            {wide ? (
              <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: theme.backgroundSelected }]}>
                {['이름(닉네임)', '역할·소속', '상태', '마지막 접속', '가입일'].map((title, i) => (
                  <ThemedText key={title} type="smallBold" themeColor="textSecondary" style={COLUMNS[i]}>
                    {title}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              회원이 없어요.
            </ThemedText>
          )
        }
        renderItem={({ item }) => (wide ? <TableRow user={item} onPress={() => open(item)} /> : <CompactRow user={item} onPress={() => open(item)} />)}
        ListFooterComponent={
          data && pages > 1 ? (
            <View style={styles.pager}>
              <AdminButtonRow>
                <AdminButton secondary label="이전" disabled={page <= 1} onPress={() => setPage(page - 1)} />
                <AdminButton secondary label="다음" disabled={page >= pages} onPress={() => setPage(page + 1)} />
              </AdminButtonRow>
              <ThemedText type="small" themeColor="textSecondary">
                {page} / {pages}쪽 · {data.total.toLocaleString()}명
              </ThemedText>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const COLUMNS = [{ flex: 2.2 }, { flex: 1.8 }, { flex: 1.2 }, { flex: 1 }, { flex: 1 }] as const;
const roleText = (user: AdminUser) =>
  [ROLE_LABELS[user.role], user.agency?.name, user.actorSelf ? `${user.actorSelf.legalName} 본인` : null].filter(Boolean).join(' · ');
const abnormal = (user: AdminUser) => user.status !== 'ACTIVE' || !!user.deletedAt;

function TableRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered }) => [styles.tableRow, { borderBottomColor: theme.backgroundSelected }, hovered && { backgroundColor: theme.backgroundElement }]}>
      <View style={COLUMNS[0]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {user.nickname ?? user.displayName}
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
          {user.displayName}
          {user.email ? ` · ${user.email}` : ''}
        </ThemedText>
      </View>
      <ThemedText type="small" style={COLUMNS[1]} numberOfLines={2}>
        {roleText(user)}
      </ThemedText>
      <ThemedText type="small" themeColor={abnormal(user) ? 'danger' : 'textSecondary'} style={COLUMNS[2]} numberOfLines={1}>
        {statusText(user)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={COLUMNS[3]} numberOfLines={1}>
        {user.lastActiveAt ? timeAgo(user.lastActiveAt) : '없음'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={COLUMNS[4]} numberOfLines={1}>
        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
      </ThemedText>
    </Pressable>
  );
}

function CompactRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.compact, { borderBottomColor: theme.backgroundSelected }]}>
      <View style={styles.compactTop}>
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
          {user.nickname ?? user.displayName}
          {user.nickname ? (
            <ThemedText type="small" themeColor="textTertiary">
              {`  ${user.displayName}`}
            </ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="small" themeColor={abnormal(user) ? 'danger' : 'textSecondary'}>
          {statusText(user)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {roleText(user)} · {user.lastActiveAt ? `접속 ${timeAgo(user.lastActiveAt)}` : '접속 없음'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.four },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  search: { borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  tableHead: { marginTop: Spacing.two },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  compact: { paddingVertical: Spacing.two + 2, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  compactTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pager: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
