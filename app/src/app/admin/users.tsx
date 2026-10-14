import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  useAdminAgencies,
  useAdminUsers,
  useAdminUserAccessLogs,
  useAssignStaffAgency,
  useChangeUserRole,
  useSuspendUser,
  useBanUser,
  useReactivateUser,
  useClearUserProfile,
  type AccessLog,
  type AdminUser,
  type AdminUserSort,
  type AssignableRole,
  type SanctionCategory,
} from '@/hooks/use-admin';
import { AdminChip, AdminMessage } from '@/components/admin-ui';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const SUSPEND_DURATIONS_DAYS = [1, 3, 7];

function suspendUntilIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function statusLabel(status: AdminUser['status']) {
  switch (status) {
    case 'SUSPENDED':
      return '일시정지';
    case 'BANNED':
      return '영구차단';
    default:
      return '정상';
  }
}

const ROLE_LABELS: Record<AdminUser['role'], string> = {
  USER: '팬',
  ACTOR: '아티스트',
  AGENCY_STAFF: '소속사 직원',
  ADMIN: '운영자',
};
const ASSIGNABLE: AssignableRole[] = ['USER', 'ACTOR', 'AGENCY_STAFF'];

// 스타·소속사 직원도 일반 가입(소셜 로그인)으로 들어온 뒤 여기서 역할을 바꿈. 운영자 계정은 대상 아님(서버에서도 막음)
function RoleControls({ user }: { user: AdminUser }) {
  const changeRole = useChangeUserRole();
  const assignAgency = useAssignStaffAgency();
  const { data: agencies } = useAdminAgencies();
  const [message, setMessage] = useState<string | null>(null);
  const busy = changeRole.isPending || assignAgency.isPending;
  const onError = (e: unknown) => setMessage(e instanceof ApiError ? e.message : '바꾸지 못했어요.');

  const pickRole = async (role: AssignableRole) => {
    if (role === user.role) return;
    const detail =
      user.role === 'ACTOR' && user.actorSelf
        ? `\n${user.actorSelf.legalName} 아티스트 본인 계정 연결이 해제돼요.`
        : user.role === 'AGENCY_STAFF' && user.agency
          ? `\n${user.agency.name} 소속사 배정이 해제돼요.`
          : '';
    const ok = await confirm('역할 변경', `${user.displayName} 계정을 "${ROLE_LABELS[role]}"(으)로 바꿀까요?${detail}`, '변경', '취소');
    if (ok) {
      setMessage(null);
      changeRole.mutate({ id: user.id, role }, { onError });
    }
  };

  return (
    <ThemedView style={styles.roleBox}>
      <ThemedView style={styles.actions}>
        {ASSIGNABLE.map((role) => (
          <AdminChip key={role} label={ROLE_LABELS[role]} selected={user.role === role} disabled={busy} onPress={() => pickRole(role)} />
        ))}
      </ThemedView>
      {user.role === 'AGENCY_STAFF' && (
        <ThemedView style={styles.actions}>
          <AdminChip
            label="소속사 없음"
            selected={!user.agency}
            disabled={busy}
            onPress={() => assignAgency.mutate({ id: user.id, agencyId: null }, { onError })}
          />
          {agencies?.map((agency) => (
            <AdminChip
              key={agency.id}
              label={agency.name}
              selected={user.agency?.id === agency.id}
              disabled={busy}
              onPress={() => assignAgency.mutate({ id: user.id, agencyId: agency.id }, { onError })}
            />
          ))}
        </ThemedView>
      )}
      <AdminMessage text={message} error />
    </ThemedView>
  );
}

// ── 접속 기록(2026-10-14) — 소속사에 데모를 보낸 뒤 들어와 봤는지, 도용·분쟁 때 어떤 기기였는지 ──
const PLATFORM_LABELS: Record<string, string> = { ios: 'iOS 앱', android: '안드로이드 앱', web: '웹' };
const METHOD_LABELS: Record<string, string> = {
  GOOGLE: 'Google',
  APPLE: 'Apple',
  KAKAO: 'Kakao',
  NAVER: 'Naver',
  LINE: 'LINE',
  DEV: '데모 로그인',
};

// 마지막 접속은 한 시간에 한 번만 갱신돼서 한 시간 안쪽은 "1시간 이내"로만
function timeAgo(iso: string): string {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (minutes < 60) return '1시간 이내';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function deviceText(log: Pick<AccessLog, 'platform' | 'deviceModel' | 'osVersion' | 'appVersion'>): string {
  return [
    log.platform ? (PLATFORM_LABELS[log.platform] ?? log.platform) : null,
    log.deviceModel,
    log.osVersion,
    log.appVersion ? `v${log.appVersion}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function AccessHistory({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const { data: logs, isLoading, isError } = useAdminUserAccessLogs(user.id, open);
  const last = user.accessLogs?.[0];
  const lastDevice = last ? deviceText(last) : '';

  return (
    <ThemedView style={styles.accessBox}>
      <ThemedView style={styles.actions}>
        <ThemedText type="small" themeColor={user.lastActiveAt ? 'textSecondary' : 'danger'} style={styles.profileLine}>
          {user.lastActiveAt ? `마지막 접속: ${timeAgo(user.lastActiveAt)}` : '접속 기록 없음'}
          {lastDevice ? ` · ${lastDevice}` : ''}
        </ThemedText>
        <AdminChip label={open ? '접속 기록 닫기' : '접속 기록'} selected={open} onPress={() => setOpen(!open)} />
      </ThemedView>
      {open &&
        (isLoading ? (
          <ActivityIndicator style={styles.accessLoading} />
        ) : isError ? (
          <ThemedText type="small" themeColor="danger">
            접속 기록을 불러오지 못했어요.
          </ThemedText>
        ) : !logs?.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            최근 3개월 접속 기록이 없어요.
          </ThemedText>
        ) : (
          logs.map((log) => (
            <ThemedText key={log.id} type="small" themeColor="textSecondary">
              {`${new Date(log.createdAt).toLocaleString('ko-KR')} · `}
              <ThemedText type="small" themeColor={log.kind === 'LOGIN' ? 'text' : 'textSecondary'}>
                {log.kind === 'LOGIN' ? `로그인${log.method ? `(${METHOD_LABELS[log.method] ?? log.method})` : ''}` : '접속'}
              </ThemedText>
              {[deviceText(log), log.ip].filter(Boolean).map((part) => ` · ${part}`).join('')}
            </ThemedText>
          ))
        ))}
    </ThemedView>
  );
}

// 제재 사유 분류 — 신고 사유와 같은 5가지. 당사자에게는 분류만 번역해서 안내되고, 메모는 운영자만 봄
const SANCTION_LABELS: Record<SanctionCategory, string> = {
  SPAM: '스팸·광고',
  ABUSE: '욕설·괴롭힘',
  SEXUAL: '음란·성적',
  PRIVACY: '개인정보 노출',
  OTHER: '기타',
};

function UserRow({ user }: { user: AdminUser }) {
  const theme = useTheme();
  const suspend = useSuspendUser();
  const ban = useBanUser();
  const reactivate = useReactivateUser();
  const clearProfile = useClearUserProfile();
  const isPending = suspend.isPending || ban.isPending || reactivate.isPending || clearProfile.isPending;
  const [category, setCategory] = useState<SanctionCategory | null>(null);
  const [note, setNote] = useState('');

  const handleSuspend = (days: number) => {
    if (!category) return;
    suspend.mutate({ id: user.id, until: suspendUntilIso(days), category, note });
  };

  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={styles.rowHeader}>
        <ThemedText type="smallBold">
          {user.displayName}
          {user.nickname ? ` (${user.nickname})` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor={user.status === 'ACTIVE' && !user.deletedAt ? 'textSecondary' : 'danger'}>
          {user.deletedAt ? `탈퇴 (${new Date(user.deletedAt).toLocaleDateString('ko-KR')})` : statusLabel(user.status)}
        </ThemedText>
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        {user.email ?? '이메일 없음'} · {ROLE_LABELS[user.role]}
        {user.agency ? ` · ${user.agency.name}` : ''}
        {user.actorSelf ? ` · ${user.actorSelf.legalName} 본인` : ''}
      </ThemedText>
      <AccessHistory user={user} />
      {/* 팬 프로필(2026-10-12) — 부적절하면 지움 */}
      {user.statusMessage || user.profileImageUrl ? (
        <ThemedView style={styles.actions}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.profileLine}>
            {`프로필: ${user.profileImageUrl ? '사진 있음' : '사진 없음'}${user.statusMessage ? ` · "${user.statusMessage}"` : ''}`}
          </ThemedText>
          <Pressable
            disabled={isPending}
            onPress={() => clearProfile.mutate(user.id)}
            style={[styles.actionChip, { borderColor: theme.danger }]}>
            <ThemedText type="small" themeColor="danger">
              사진·상태메시지 지우기
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
      {user.role !== 'ADMIN' && !user.deletedAt && <RoleControls user={user} />}
      {user.status === 'SUSPENDED' && user.suspendedUntil && (
        <ThemedText type="small" themeColor="textSecondary">
          해제: {new Date(user.suspendedUntil).toLocaleString('ko-KR')}
        </ThemedText>
      )}
      {user.status !== 'ACTIVE' && user.sanctionCategory && (
        <ThemedText type="small" themeColor="textSecondary">
          사유: {SANCTION_LABELS[user.sanctionCategory]}
          {user.sanctionNote ? ` — ${user.sanctionNote}` : ''}
        </ThemedText>
      )}

      {/* 정지·영구차단은 사유 분류를 먼저 골라야 함(작업 기록·당사자 안내용) */}
      <ThemedView style={styles.actions}>
        {(Object.keys(SANCTION_LABELS) as SanctionCategory[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setCategory(category === key ? null : key)}
            style={[styles.actionChip, { borderColor: category === key ? theme.tint : theme.backgroundSelected, backgroundColor: category === key ? theme.tintSoft : 'transparent' }]}>
            <ThemedText type="small">{SANCTION_LABELS[key]}</ThemedText>
          </Pressable>
        ))}
      </ThemedView>
      {category && (
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="내부 메모(선택, 당사자에게 안 보임)"
          placeholderTextColor={theme.textSecondary}
          maxLength={500}
          style={[styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
      )}
      <ThemedView style={styles.actions}>
        {SUSPEND_DURATIONS_DAYS.map((days) => (
          <Pressable
            key={days}
            disabled={isPending || !category}
            onPress={() => handleSuspend(days)}
            style={[styles.actionChip, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="small">{days}일 정지</ThemedText>
          </Pressable>
        ))}
        <Pressable
          disabled={isPending || !category}
          onPress={() => category && ban.mutate({ id: user.id, category, note })}
          style={[styles.actionChip, { borderColor: theme.danger }]}>
          <ThemedText type="small" themeColor="danger">
            영구차단
          </ThemedText>
        </Pressable>
        {user.status !== 'ACTIVE' && (
          <Pressable
            disabled={isPending}
            onPress={() => reactivate.mutate(user.id)}
            style={[styles.actionChip, { backgroundColor: theme.tint, borderColor: theme.tint }]}>
            <ThemedText type="small" style={styles.reactivateChipText}>
              재활성화
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const ROLE_FILTERS: (AdminUser['role'] | null)[] = [null, 'USER', 'ACTOR', 'AGENCY_STAFF', 'ADMIN'];

export default function AdminUsersScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AdminUser['role'] | null>(null);
  const [sort, setSort] = useState<AdminUserSort | undefined>(undefined);
  const { data: users, isLoading } = useAdminUsers(query, role ?? undefined, sort);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ThemedView style={styles.header}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="이름·닉네임·이메일로 검색"
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        {/* 역할·정렬 — 예) 소속사 직원 + 최근 접속순으로 데모를 받은 소속사가 들어와 봤는지 확인 */}
        <ThemedView style={styles.actions}>
          {ROLE_FILTERS.map((value) => (
            <AdminChip key={value ?? 'ALL'} label={value ? ROLE_LABELS[value] : '전체'} selected={role === value} onPress={() => setRole(value)} />
          ))}
        </ThemedView>
        <ThemedView style={styles.actions}>
          <AdminChip label="가입 최신순" selected={!sort} onPress={() => setSort(undefined)} />
          <AdminChip label="최근 접속순" selected={sort === 'recent'} onPress={() => setSort('recent')} />
        </ThemedView>
      </ThemedView>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
              회원이 없어요.
            </ThemedText>
          }
          renderItem={({ item }) => <UserRow user={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  search: { borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  list: { padding: Spacing.four, gap: Spacing.three },
  row: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two, backgroundColor: 'transparent' },
  roleBox: { backgroundColor: 'transparent' },
  accessBox: { gap: 2, backgroundColor: 'transparent' },
  accessLoading: { alignSelf: 'flex-start', marginVertical: Spacing.one },
  actionChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 6 },
  reactivateChipText: { color: '#fff' },
  profileLine: { flexShrink: 1 },
  noteInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 14 },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
