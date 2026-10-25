import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip } from '@/components/admin-ui';
import { AdminBadge, AdminCompactRow, AdminListRow, AdminSortHeader, AdminStatTiles, type BadgeTone } from '@/components/admin-table';
import { ROLE_LABELS, timeAgo } from '@/components/admin-user-panels';
import { useWideLayout } from '@/components/wide-shell';
import { useAdminUsers, type AdminUser, type AdminUserFilter, type AdminUserSort } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const ROLE_FILTERS: (AdminUser['role'] | null)[] = [null, 'USER', 'ACTOR', 'AGENCY_STAFF', 'ADMIN'];
const TILES: { key: AdminUserFilter | 'all'; label: string; tone: BadgeTone }[] = [
  { key: 'all', label: '전체', tone: 'ok' },
  { key: 'today', label: '오늘 가입(태국)', tone: 'ok' },
  { key: 'subscribed', label: '구독 중', tone: 'ok' },
  { key: 'sanctioned', label: '제재 중', tone: 'danger' },
];
type SortKey = 'created' | 'recent';
// 정렬은 서버가 함(한 쪽 50명씩) — 가입일·마지막 접속 둘 다 최신순만
const COLUMNS: { title: string; flex: number; sortKey?: SortKey; firstDir?: 'desc' }[] = [
  { title: '이름(닉네임)', flex: 2.2 },
  { title: '역할', flex: 0.9 },
  { title: '소속', flex: 1.4 },
  { title: '상태', flex: 1.3 },
  { title: '구독 방', flex: 0.7 },
  { title: '마지막 접속', flex: 1, sortKey: 'recent', firstDir: 'desc' },
  { title: '가입일', flex: 1, sortKey: 'created', firstDir: 'desc' },
];

/**
 * 회원 관리(2026-10-20 표, 2026-10-25 개편: "정보가 많아 정신없다" — 회원 상세처럼 요약 카드 + 표 + 색 배지).
 * 맨 위 요약 카드(전체·오늘 가입·구독 중·제재 중)를 누르면 그 조건으로 거름. PC는 표(가입일·마지막 접속 열 제목으로 정렬), 폰 폭은 한 줄 카드(이름·상태·구독 방).
 * 이메일·기기 같은 부가 정보는 회원 상세. 역할 칩 옆에 인원수, 한 쪽 50명씩.
 */
export default function AdminUsersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const wide = useWideLayout();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AdminUser['role'] | null>(null);
  const [filter, setFilter] = useState<AdminUserFilter | null>(null);
  const [sort, setSort] = useState<AdminUserSort | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAdminUsers(query.trim(), role ?? undefined, sort, page, filter ?? undefined);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const open = (user: AdminUser) => router.push({ pathname: '/admin/users/[id]', params: { id: user.id } });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, !wide && styles.listNarrow]}
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
            <AdminStatTiles
              tiles={TILES.map((tile) => ({ ...tile, count: data?.summary[tile.key] }))}
              selected={filter ?? (data ? 'all' : null)}
              onSelect={(key) => reset(setFilter)(key === 'all' || key === null ? null : (key as AdminUserFilter))}
            />
            <View style={styles.chips}>
              {ROLE_FILTERS.map((value) => (
                <AdminChip
                  key={value ?? 'ALL'}
                  label={value ? ROLE_LABELS[value] : '모든 역할'}
                  count={data?.counts[value ?? 'ALL']}
                  selected={role === value}
                  onPress={() => reset(setRole)(value)}
                />
              ))}
              {/* 폰 폭은 열 제목이 없어서 칩으로. 예) 소속사 직원 + 최근 접속순으로 데모를 받은 소속사가 들어와 봤는지 확인 */}
              {!wide ? <AdminChip label="최근 접속순" selected={sort === 'recent'} onPress={() => reset(setSort)(sort === 'recent' ? undefined : 'recent')} /> : null}
              {isFetching ? <ActivityIndicator color={theme.tint} /> : null}
            </View>
            {wide ? (
              <AdminSortHeader
                columns={COLUMNS}
                sort={{ key: sort === 'recent' ? 'recent' : 'created', dir: 'desc' }}
                onSort={(next) => reset(setSort)(next.key === 'recent' ? 'recent' : undefined)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.tint} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              {query || role || filter ? '조건에 맞는 회원이 없어요.' : '회원이 없어요.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) =>
          wide ? (
            <AdminListRow
              columns={COLUMNS}
              faded={!!item.deletedAt}
              onPress={() => open(item)}
              cells={[
                <NameCell key="name" user={item} />,
                ROLE_LABELS[item.role],
                affiliation(item) ?? '-',
                <StatusBadge key="status" user={item} />,
                <RoomCount key="rooms" user={item} />,
                <ThemedText key="active" type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.lastActiveAt ? timeAgo(item.lastActiveAt) : '없음'}
                </ThemedText>,
                <ThemedText key="created" type="small" themeColor="textSecondary" numberOfLines={1}>
                  {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                </ThemedText>,
              ]}
            />
          ) : (
            <AdminCompactRow
              faded={!!item.deletedAt}
              onPress={() => open(item)}
              left={<NameCell user={item} narrow />}
              right={
                <>
                  <StatusBadge user={item} />
                  <RoomCount user={item} />
                </>
              }
            />
          )
        }
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

const affiliation = (user: AdminUser) => user.agency?.name ?? (user.actorSelf ? `${user.actorSelf.legalName} 본인` : null);

function statusBadge(user: AdminUser): { label: string; tone: BadgeTone } {
  if (user.deletedAt) return { label: '탈퇴', tone: 'muted' };
  if (user.status === 'BANNED') return { label: '영구차단', tone: 'danger' };
  if (user.status === 'SUSPENDED') return { label: user.suspendedUntil ? `정지 ~${new Date(user.suspendedUntil).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}` : '정지 중', tone: 'danger' };
  // 목록에선 정상은 회색 — 빨간 제재가 눈에 띄게
  return { label: '정상', tone: 'muted' };
}

function StatusBadge({ user }: { user: AdminUser }) {
  const { label, tone } = statusBadge(user);
  return <AdminBadge label={label} tone={tone} />;
}

function RoomCount({ user }: { user: AdminUser }) {
  const rooms = user.activeRoomCount ?? 0;
  return <AdminBadge label={`방 ${rooms}`} tone={rooms ? 'ok' : 'muted'} />;
}

function NameCell({ user, narrow }: { user: AdminUser; narrow?: boolean }) {
  // 폰 폭은 역할을 이름 밑에(팬이 대부분이라 팬은 생략)
  const sub = narrow ? [user.role === 'USER' ? null : ROLE_LABELS[user.role], user.nickname ? user.displayName : null].filter(Boolean).join(' · ') : user.nickname ? user.displayName : '';
  return (
    <View style={styles.flex}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {user.nickname ?? user.displayName}
      </ThemedText>
      {sub ? (
        <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  list: { padding: Spacing.four },
  listNarrow: { gap: Spacing.two },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  search: { borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  pager: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
