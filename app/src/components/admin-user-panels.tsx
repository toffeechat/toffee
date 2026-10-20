import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip, AdminMessage, AdminSection } from '@/components/admin-ui';
import {
  useAdminAgencies,
  useAdminUserAccessLogs,
  useAssignStaffAgency,
  useBanUser,
  useChangeUserRole,
  useClearUserProfile,
  useReactivateUser,
  useSuspendUser,
  type AccessLog,
  type AdminUser,
  type AssignableRole,
  type SanctionCategory,
} from '@/hooks/use-admin';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

// 회원 관리 목록·상세 공용(2026-10-20 개편 — 목록은 표, 바꾸는 일은 상세에서). 운영자 화면은 한국어 전용

export const ROLE_LABELS: Record<AdminUser['role'], string> = {
  USER: '팬',
  ACTOR: '아티스트',
  AGENCY_STAFF: '소속사 직원',
  ADMIN: '운영자',
};
const ASSIGNABLE: AssignableRole[] = ['USER', 'ACTOR', 'AGENCY_STAFF'];

// 제재 사유 분류 — 신고 사유와 같은 5가지. 당사자가 앱을 열면 "사유: 욕설·괴롭힘"처럼 그 사람 언어로 보이고, 메모는 운영자만 봄
export const SANCTION_LABELS: Record<SanctionCategory, string> = {
  SPAM: '스팸·광고',
  ABUSE: '욕설·괴롭힘',
  SEXUAL: '음란·성적',
  PRIVACY: '개인정보 노출',
  OTHER: '기타',
};
// 정지 기간(일) — 0 = 영구차단
const DURATIONS: { days: number; label: string }[] = [
  { days: 1, label: '1일 정지' },
  { days: 3, label: '3일 정지' },
  { days: 7, label: '7일 정지' },
  { days: 30, label: '30일 정지' },
  { days: 0, label: '영구차단' },
];

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** 목록·상세에 보이는 상태 글 */
export function statusText(user: AdminUser): string {
  if (user.deletedAt) return `탈퇴(${new Date(user.deletedAt).toLocaleDateString('ko-KR')})`;
  if (user.status === 'SUSPENDED') return user.suspendedUntil ? `정지 중(~${new Date(user.suspendedUntil).toLocaleDateString('ko-KR')})` : '정지 중';
  if (user.status === 'BANNED') return '영구차단';
  return '정상';
}

// 마지막 접속은 한 시간에 한 번만 갱신돼서 한 시간 안쪽은 "1시간 이내"로만
export function timeAgo(iso: string): string {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (minutes < 60) return '1시간 이내';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

// ── 접속 기록(2026-10-14) — 소속사에 데모를 보낸 뒤 들어와 봤는지, 도용·분쟁 때 어떤 기기였는지 ──
const PLATFORM_LABELS: Record<string, string> = { ios: 'iOS 앱', android: '안드로이드 앱', web: '웹' };
const METHOD_LABELS: Record<string, string> = { GOOGLE: 'Google', APPLE: 'Apple', KAKAO: 'Kakao', NAVER: 'Naver', LINE: 'LINE', DEV: '데모 로그인' };

export function deviceText(log: Pick<AccessLog, 'platform' | 'deviceModel' | 'osVersion' | 'appVersion'>): string {
  return [log.platform ? (PLATFORM_LABELS[log.platform] ?? log.platform) : null, log.deviceModel, log.osVersion, log.appVersion ? `v${log.appVersion}` : null]
    .filter(Boolean)
    .join(' · ');
}

export function AccessHistory({ user }: { user: AdminUser }) {
  const { data: logs, isLoading, isError } = useAdminUserAccessLogs(user.id, true);
  const last = user.accessLogs?.[0];
  return (
    <AdminSection title="접속 기록" hint="최근 3개월 · 로그인할 때마다, 로그인 유지 중엔 한 시간에 한 번">
      <ThemedText type="small" themeColor={user.lastActiveAt ? 'text' : 'danger'}>
        {user.lastActiveAt ? `마지막 접속: ${timeAgo(user.lastActiveAt)}` : '접속 기록 없음'}
        {last ? ` · ${deviceText(last)}` : ''}
      </ThemedText>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : isError ? (
        <AdminMessage text="접속 기록을 불러오지 못했어요." error />
      ) : (
        logs?.slice(0, 30).map((log) => (
          <ThemedText key={log.id} type="small" themeColor="textSecondary">
            {`${new Date(log.createdAt).toLocaleString('ko-KR')} · ${log.kind === 'LOGIN' ? `로그인${log.method ? `(${METHOD_LABELS[log.method] ?? log.method})` : ''}` : '접속'}`}
            {[deviceText(log), log.ip].filter(Boolean).map((part) => ` · ${part}`).join('')}
          </ThemedText>
        ))
      )}
    </AdminSection>
  );
}

/** 역할·소속사 — 바꾸기 전에 늘 한 번 더 물어봄(2026-10-20 사용자 요청: 소속사도 누르면 바로 바뀌지 않게) */
export function RoleSection({ user }: { user: AdminUser }) {
  const changeRole = useChangeUserRole();
  const assignAgency = useAssignStaffAgency();
  const { data: agencies } = useAdminAgencies();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const busy = changeRole.isPending || assignAgency.isPending;
  const onError = (e: unknown) => setMessage({ text: errorText(e, '바꾸지 못했어요.'), error: true });

  const pickRole = async (role: AssignableRole) => {
    if (role === user.role) return;
    const detail =
      user.role === 'ACTOR' && user.actorSelf
        ? `\n${user.actorSelf.legalName} 아티스트 본인 계정 연결이 해제돼요.`
        : user.role === 'AGENCY_STAFF' && user.agency
          ? `\n${user.agency.name} 소속사 배정이 해제돼요.`
          : '';
    if (await confirm('역할 변경', `${user.displayName} 계정을 "${ROLE_LABELS[role]}"(으)로 바꿀까요?${detail}`, '변경', '취소')) {
      setMessage(null);
      changeRole.mutate({ id: user.id, role }, { onError, onSuccess: () => setMessage({ text: `${ROLE_LABELS[role]}(으)로 바꿨어요.` }) });
    }
  };
  const pickAgency = async (agencyId: string | null, name: string) => {
    if ((user.agency?.id ?? null) === agencyId) return;
    const body = agencyId
      ? `${user.displayName} 직원을 "${name}" 소속으로 바꿀까요?${user.agency ? `\n${user.agency.name}의 아티스트·정산은 더 이상 볼 수 없어요.` : ''}`
      : `${user.displayName} 직원의 소속을 없앨까요? 어느 소속사 화면도 볼 수 없게 돼요.`;
    if (await confirm('소속사 변경', body, '변경', '취소')) {
      setMessage(null);
      assignAgency.mutate({ id: user.id, agencyId }, { onError, onSuccess: () => setMessage({ text: agencyId ? `${name} 소속으로 바꿨어요.` : '소속을 없앴어요.' }) });
    }
  };

  return (
    <AdminSection title="역할" hint="아티스트·소속사 직원도 일반 가입(소셜 로그인) 뒤 여기서 바꿔요. 구독 중인 팬 계정은 바꿀 수 없어요.">
      <View style={styles.chips}>
        {ASSIGNABLE.map((role) => (
          <AdminChip key={role} label={ROLE_LABELS[role]} selected={user.role === role} disabled={busy} onPress={() => void pickRole(role)} />
        ))}
      </View>
      {user.role === 'AGENCY_STAFF' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            소속사
          </ThemedText>
          <View style={styles.chips}>
            <AdminChip label="소속사 없음" selected={!user.agency} disabled={busy} onPress={() => void pickAgency(null, '')} />
            {agencies?.map((agency) => (
              <AdminChip key={agency.id} label={agency.name} selected={user.agency?.id === agency.id} disabled={busy} onPress={() => void pickAgency(agency.id, agency.name)} />
            ))}
          </View>
        </>
      ) : null}
      <AdminMessage text={message?.text ?? null} error={message?.error} />
    </AdminSection>
  );
}

/**
 * 제재 — ① 사유(당사자에게 보임) ② 기간 ③ 내부 메모(운영자만) → 확인. 예전엔 사유를 안 고르면 기간 버튼이 말없이 안 눌려서 고장처럼 보였음(2026-10-20).
 * 당사자는 앱을 열면 "일시정지된 계정이에요. ○일부터 다시 이용할 수 있어요. 사유: 욕설·괴롭힘"을 자기 언어로 봄. 작업 기록에도 남음.
 */
export function SanctionSection({ user }: { user: AdminUser }) {
  const theme = useTheme();
  const suspend = useSuspendUser();
  const ban = useBanUser();
  const reactivate = useReactivateUser();
  const [category, setCategory] = useState<SanctionCategory | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const busy = suspend.isPending || ban.isPending || reactivate.isPending;
  const onError = (e: unknown) => setMessage({ text: errorText(e, '처리하지 못했어요.'), error: true });
  const done = (text: string) => () => {
    setMessage({ text });
    setCategory(null);
    setDays(null);
    setNote('');
  };

  const apply = async () => {
    if (!category || days === null) return;
    const what = days === 0 ? '영구차단' : `${days}일 정지`;
    const ok = await confirm(
      what,
      `${user.nickname ?? user.displayName} 계정을 ${what}할까요?\n당사자에게 "사유: ${SANCTION_LABELS[category]}"가 보여요. 메모는 운영자만 봐요.`,
      what,
      '취소',
    );
    if (!ok) return;
    setMessage(null);
    if (days === 0) ban.mutate({ id: user.id, category, note }, { onError, onSuccess: done('영구차단했어요.') });
    else suspend.mutate({ id: user.id, until: new Date(Date.now() + days * 86_400_000).toISOString(), category, note }, { onError, onSuccess: done(`${days}일 정지했어요.`) });
  };
  const lift = async () => {
    if (await confirm('제재 해제', `${user.nickname ?? user.displayName} 계정의 정지·차단을 풀까요? 바로 다시 쓸 수 있어요.`, '해제', '취소')) {
      reactivate.mutate(user.id, { onError, onSuccess: done('제재를 풀었어요.') });
    }
  };

  return (
    <AdminSection title="제재" hint="① 사유 → ② 기간 → ③ 메모(선택) 순서로 고른 뒤 [적용]. 사유는 당사자에게 보이고, 메모는 운영자만 봐요.">
      {user.status !== 'ACTIVE' ? (
        <View style={[styles.current, { borderColor: theme.danger }]}>
          <ThemedText type="smallBold" themeColor="danger">
            지금: {statusText(user)}
          </ThemedText>
          {user.sanctionCategory ? (
            <ThemedText type="small" themeColor="textSecondary">
              사유: {SANCTION_LABELS[user.sanctionCategory]}
              {user.sanctionNote ? ` — 메모: ${user.sanctionNote}` : ''}
            </ThemedText>
          ) : null}
          <AdminButtonRow>
            <AdminButton secondary label={reactivate.isPending ? '푸는 중…' : '제재 해제'} disabled={busy} onPress={() => void lift()} />
          </AdminButtonRow>
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        ① 사유(당사자에게 보임)
      </ThemedText>
      <View style={styles.chips}>
        {(Object.keys(SANCTION_LABELS) as SanctionCategory[]).map((key) => (
          <AdminChip key={key} label={SANCTION_LABELS[key]} selected={category === key} onPress={() => setCategory(category === key ? null : key)} />
        ))}
      </View>
      <ThemedText type="small" themeColor={category ? 'textSecondary' : 'textTertiary'}>
        ② 기간{category ? '' : ' — 사유를 먼저 골라 주세요'}
      </ThemedText>
      <View style={styles.chips}>
        {DURATIONS.map((option) => (
          <AdminChip key={option.days} label={option.label} danger={option.days === 0} selected={days === option.days} disabled={!category} onPress={() => setDays(option.days)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        ③ 내부 메모(선택, 운영자만 봄 — 예: 신고 3건, 같은 아티스트에게 반복 욕설)
      </ThemedText>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="메모"
        placeholderTextColor={theme.textSecondary}
        maxLength={500}
        style={[styles.note, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}
      />
      <AdminButtonRow>
        <AdminButton
          label={busy ? '처리 중…' : !category ? '사유를 골라 주세요' : days === null ? '기간을 골라 주세요' : `${DURATIONS.find((option) => option.days === days)!.label} 적용`}
          disabled={busy || !category || days === null}
          onPress={() => void apply()}
        />
      </AdminButtonRow>
      <AdminMessage text={message?.text ?? null} error={message?.error} />
    </AdminSection>
  );
}

/** 팬 프로필(2026-10-12) — 부적절하면 지움 */
export function ProfileSection({ user }: { user: AdminUser }) {
  const clear = useClearUserProfile();
  if (!user.statusMessage && !user.profileImageUrl) return null;
  const run = async () => {
    if (await confirm('프로필 지우기', '이 팬의 프로필 사진과 상태메시지를 지울까요? 되돌릴 수 없어요.', '지우기', '취소')) clear.mutate(user.id);
  };
  return (
    <AdminSection title="팬 프로필" hint="아티스트·소속사 답장 화면에만 보여요.">
      <ThemedText type="small">
        {user.profileImageUrl ? '사진 있음' : '사진 없음'}
        {user.statusMessage ? ` · "${user.statusMessage}"` : ''}
      </ThemedText>
      <AdminButtonRow>
        <AdminButton secondary label={clear.isPending ? '지우는 중…' : '사진·상태메시지 지우기'} disabled={clear.isPending} onPress={() => void run()} />
      </AdminButtonRow>
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  loading: { alignSelf: 'flex-start', marginVertical: Spacing.one },
  current: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, gap: 4 },
  note: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 14 },
});
