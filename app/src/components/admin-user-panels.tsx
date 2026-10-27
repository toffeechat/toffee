import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip, AdminMessage, AdminSection } from '@/components/admin-ui';
import { AdminBadge, AdminBadgeRow, AdminSummaryCard, AdminTable, AdminTableBlock, type BadgeTone } from '@/components/admin-table';
import {
  useAdminAgencies,
  useAdminUserAccessLogs,
  useAdminUserActivity,
  useAdminUserBilling,
  useAssignStaffAgency,
  useBanUser,
  useChangeUserRole,
  useClearUserProfile,
  useReactivateUser,
  useSuspendUser,
  type AccessLog,
  type AdminUserActivity,
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
        {/* 기기 정보가 없는 접속(앱 밖에서 API로 로그인 등)이면 " · "만 남지 않게(2026-10-20) */}
        {last && deviceText(last) ? ` · ${deviceText(last)}` : ''}
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

const PLATFORM: Record<string, string> = { IOS: '애플', ANDROID: '구글', SANDBOX: '테스트', APPLE: '애플', GOOGLE: '구글' };
const REFUND_REASON: Record<string, string> = { STAR_IDLE: '아티스트 미발송', ACTOR_RETIRED: '활동 종료' };
const day = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');
const at = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
const baht = (cents: number) => `${cents < 0 ? '-' : ''}฿${(Math.abs(cents) / 100).toLocaleString('ko-KR')}`;
const short = (text: string | null, max = 60) => (!text ? '' : text.length > max ? `${text.slice(0, max)}…` : text);
const roomName = (actor: { legalName: string; kind?: 'SOLO' | 'COUPLE' }) => `${actor.legalName}${actor.kind === 'COUPLE' ? ' [CP]' : ''}`;

/** 표 칸 안의 보조 글(작고 흐리게) */
function Sub({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="caption" themeColor="textTertiary">
      {children}
    </ThemedText>
  );
}

// ── 상태 요약(2026-10-22) — 회원 상세(팬) 맨 위. 답장을 못 보내는 이유가 있으면 빨간 카드 ──
export function FanSummaryCard({ user }: { user: AdminUser }) {
  const { data: activity } = useAdminUserActivity(user.id);
  const { data: billing } = useAdminUserBilling(user.id);
  const openRooms = billing?.rooms.filter((room) => !room.cancelledAt).length ?? 0;
  const pendingReports = activity?.reportsReceived.filter((report) => report.status === 'PENDING').length ?? 0;
  const blocks = activity?.blocks ?? [];
  const sanctioned = user.status !== 'ACTIVE';
  const reasons = [
    user.status === 'SUSPENDED' ? `계정 정지 중${user.suspendedUntil ? `(~${day(user.suspendedUntil)})` : ''} — 모든 방에서 답장 불가` : null,
    user.status === 'BANNED' ? '영구차단 — 모든 방에서 답장 불가' : null,
    ...blocks.map((block) => `${block.actor.legalName} 방에서 차단됨(${day(block.createdAt)}) — 그 방만 답장 불가, 보기는 됨`),
  ].filter((reason): reason is string => !!reason);
  return (
    <AdminSummaryCard alert={reasons.length > 0} title={reasons.length ? '답장을 못 보내는 이유가 있어요' : '답장 막힘 없음'}>
      <AdminBadgeRow>
        <AdminBadge label={statusText(user)} tone={sanctioned || user.deletedAt ? 'danger' : 'ok'} />
        <AdminBadge label={`열린 방 ${openRooms}`} tone={openRooms ? 'ok' : 'muted'} />
        <AdminBadge label={`방 차단 ${blocks.length}`} tone={blocks.length ? 'danger' : 'muted'} />
        <AdminBadge label={`받은 신고 ${activity?.reportsReceived.length ?? 0}${pendingReports ? `(대기 ${pendingReports})` : ''}`} tone={pendingReports ? 'danger' : 'muted'} />
        <AdminBadge label={`제재 기록 ${activity?.actions.length ?? 0}`} tone={activity?.actions.length ? 'warn' : 'muted'} />
      </AdminBadgeRow>
      {reasons.length ? (
        reasons.map((reason) => (
          <ThemedText key={reason} type="smallBold" themeColor="danger">
            • {reason}
          </ThemedText>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          제재·차단이 없어요. 그래도 답장이 안 된다면 그 방에 아직 아티스트 메시지가 없거나, 최근 메시지에 보낼 수 있는 답장 개수를 다 썼거나, 금칙어에 걸린 경우예요(앱이 팬에게 바로 안내해요).
        </ThemedText>
      )}
    </AdminSummaryCard>
  );
}

/** 구독·결제·환불 내역(2026-10-20, 2026-10-22 표로) — "결제했는데 안 열려요"·환불 문의 대응. 금액은 정산 기준(태국 정가 ฿), 스토어 실제 청구액은 따로 */
export function BillingSection({ userId }: { userId: string }) {
  const { data, isLoading } = useAdminUserBilling(userId);
  if (isLoading || !data) return <AdminSection title="구독·결제·환불">{isLoading ? <ActivityIndicator style={styles.loading} /> : null}</AdminSection>;
  const active = data.rooms.filter((room) => !room.cancelledAt);
  const livePurchases = data.purchases.filter((purchase) => !purchase.cancelledAt).length;
  return (
    <AdminSection title="구독·결제·환불" hint="금액은 정산 기준(바트 정가)이에요. 스토어가 실제로 청구한 금액은 괄호 안.">
      <AdminTableBlock title="지금 열린 방" count={active.length} tone="ok">
        <AdminBadgeRow>
          {active.map((room) => (
            <AdminBadge key={room.actorId} label={`${room.actor.chatDisplayName}${room.actor.kind === 'COUPLE' ? ' [CP]' : ''} · ${day(room.startedAt)}~`} tone="ok" />
          ))}
        </AdminBadgeRow>
      </AdminTableBlock>

      <AdminTableBlock title="구매" count={data.purchases.length} tone="ok" note={`이용 중 ${livePurchases}`}>
        <AdminTable
          columns={[
            { title: '상품', flex: 2.2 },
            { title: '결제한 곳', flex: 0.8 },
            { title: '월 가격', flex: 0.8 },
            { title: '시작', flex: 1 },
            { title: '상태', flex: 1.6 },
          ]}
          rows={data.purchases.map((purchase) => ({
            key: purchase.id,
            faded: !!purchase.cancelledAt,
            cells: [
              purchase.bundle ? `묶음 ${purchase.bundle.name}` : (purchase.actor?.legalName ?? '-'),
              purchase.iapPlatform ? PLATFORM[purchase.iapPlatform] : '테스트',
              purchase.priceCents !== null ? baht(purchase.priceCents) : '-',
              day(purchase.startedAt),
              purchase.cancelledAt ? (
                <AdminBadge label={`${day(purchase.cancelledAt)} 끝남`} tone="muted" />
              ) : purchase.iapExpiresAt ? (
                <AdminBadge label={`${day(purchase.iapExpiresAt)}까지 · ${purchase.willRenew ? '자동 갱신' : '갱신 안 함'}`} tone={purchase.willRenew ? 'ok' : 'warn'} />
              ) : (
                <AdminBadge label="이용 중" tone="ok" />
              ),
            ],
          }))}
        />
      </AdminTableBlock>

      <AdminTableBlock title="결제" count={data.charges.length} tone="ok" note={data.charges.length > 30 ? '최근 30건만' : undefined}>
        <AdminTable
          columns={[
            { title: '결제일', flex: 1 },
            { title: '상품', flex: 2 },
            { title: '금액', flex: 1.4 },
            { title: '결제한 곳', flex: 0.8 },
            { title: '이용 기간 끝', flex: 1 },
            { title: '환불·변경', flex: 1.1 },
          ]}
          rows={data.charges.slice(0, 30).map((charge) => ({
            key: charge.id,
            cells: [
              day(charge.chargedAt),
              charge.productName,
              <View key="amount">
                <ThemedText type="small">{baht(charge.amountCents)}</ThemedText>
                {charge.storeAmountMilli !== null && charge.storeCurrency ? <Sub>({`${(charge.storeAmountMilli / 1000).toLocaleString('ko-KR')} ${charge.storeCurrency}`})</Sub> : null}
              </View>,
              PLATFORM[charge.source] ?? charge.source,
              day(charge.periodEnd),
              charge.refundedAt ? (
                <AdminBadge label={`${day(charge.refundedAt)} 환불`} tone="danger" />
              ) : charge.kind === 'SWITCH_CREDIT' ? (
                <AdminBadge label="묶음 변경 차감" tone="warn" />
              ) : charge.kind === 'SWITCH_CARRY' ? (
                <AdminBadge label="묶음 변경 이월" tone="muted" />
              ) : (
                ''
              ),
            ],
          }))}
        />
      </AdminTableBlock>

      <AdminTableBlock title="환불 요청" count={data.refunds.length} tone="warn">
        <AdminTable
          columns={[
            { title: '요청일', flex: 1 },
            { title: '사유', flex: 1.2 },
            { title: '결제', flex: 2.4 },
            { title: '상태', flex: 1.4 },
          ]}
          rows={data.refunds.map((refund) => ({
            key: refund.id,
            cells: [
              day(refund.createdAt),
              REFUND_REASON[refund.reason] ?? refund.reason,
              `${refund.charge.productName} ${baht(refund.charge.amountCents)}`,
              refund.status === 'REFUNDED' ? (
                <AdminBadge label="환불 완료" tone="ok" />
              ) : refund.charge.refundedAt ? (
                <AdminBadge label="애플 환불 완료" tone="ok" />
              ) : (
                <AdminBadge label="애플 안내함 · 아직 환불 안 됨" tone="warn" />
              ),
            ],
          }))}
        />
      </AdminTableBlock>
    </AdminSection>
  );
}

// ── 팬 한 명 기준 보기(2026-10-22) — "왜 답장이 안 보내져요?" 같은 문의에 한 화면에서 답하려고. 맨 위 요약은 FanSummaryCard ──
const MEDIA_LABELS: Record<AdminUserActivity['replies'][number]['mediaType'], string> = { TEXT: '', PHOTO: '[사진]', AUDIO: '[음성]', VIDEO: '[영상]' };
const REPORT_STATUS: Record<AdminUserActivity['reportsReceived'][number]['status'], { label: string; tone: BadgeTone }> = {
  PENDING: { label: '처리 대기', tone: 'danger' },
  RESOLVED: { label: '승인(가림)', tone: 'warn' },
  DISMISSED: { label: '기각', tone: 'muted' },
};
// 회원 대상 작업 기록 — 전체 목록은 운영자 "작업 기록" 화면(actions.tsx)
const USER_ACTIONS: Record<string, { label: string; tone: BadgeTone }> = {
  USER_SUSPEND: { label: '정지', tone: 'danger' },
  USER_BAN: { label: '영구차단', tone: 'danger' },
  USER_REACTIVATE: { label: '제재 해제', tone: 'ok' },
  USER_PROFILE_CLEAR: { label: '프로필 지움', tone: 'warn' },
  ACTOR_STATUS_CLEAR: { label: '상태메시지 지움', tone: 'warn' },
  USER_ROLE: { label: '역할 변경', tone: 'muted' },
  USER_EXPORT: { label: '개인정보 파일 받음', tone: 'muted' },
  STAFF_AGENCY: { label: '소속사 직원 지정', tone: 'muted' },
};
const BLOCKER_ROLE: Partial<Record<AdminUser['role'], string>> = { ACTOR: '아티스트', AGENCY_STAFF: '소속사', ADMIN: '운영자' };

function replyState(reply: AdminUserActivity['replies'][number]): { label: string; tone: BadgeTone } | null {
  if (reply.deletedByAdmin) return { label: '운영자가 가림', tone: 'warn' };
  if (reply.deletedByStaffId) return { label: '소속사가 삭제', tone: 'warn' };
  if (reply.deletedAt) return { label: '팬이 회수', tone: 'muted' };
  return null;
}

function actionDetail(entry: AdminUserActivity['actions'][number]): string {
  const d = entry.detail ?? {};
  const parts: string[] = [];
  if (typeof d.category === 'string') parts.push(SANCTION_LABELS[d.category as SanctionCategory] ?? d.category);
  if (typeof d.until === 'string') parts.push(`~${day(d.until)}`);
  if (typeof d.from === 'string' && typeof d.to === 'string') parts.push(`${ROLE_LABELS[d.from as AdminUser['role']] ?? d.from} → ${ROLE_LABELS[d.to as AdminUser['role']] ?? d.to}`);
  return parts.join(' · ');
}

/** 답장·신고·차단·제재(2026-10-22, 표) — 각각 최신 50개까지, 회수·가린 답장도 기록으로 */
export function ActivitySection({ user }: { user: AdminUser }) {
  const { data, isLoading, isError } = useAdminUserActivity(user.id);
  if (isLoading) return <AdminSection title="답장·신고·차단·제재"><ActivityIndicator style={styles.loading} /></AdminSection>;
  if (isError || !data) return <AdminSection title="답장·신고·차단·제재"><AdminMessage text="불러오지 못했어요." error /></AdminSection>;
  const pendingReports = data.reportsReceived.filter((report) => report.status === 'PENDING').length;
  return (
    <AdminSection title="답장·신고·차단·제재" hint="각각 최신 50개까지. 회수·가린 답장도 기록으로 보여요.">
      <AdminTableBlock title="최근 답장" count={data.replies.length} tone="ok" note={data.replies.length > 30 ? '최근 30개만' : undefined}>
        <AdminTable
          columns={[
            { title: '보낸 때', flex: 1.1 },
            { title: '방', flex: 1.3 },
            { title: '내용', flex: 3 },
            { title: '상태', flex: 1.1 },
            { title: '신고', flex: 0.6 },
          ]}
          rows={data.replies.slice(0, 30).map((reply) => {
            const state = replyState(reply);
            return {
              key: reply.id,
              faded: !!state,
              cells: [
                at(reply.createdAt),
                roomName(reply.actor),
                [MEDIA_LABELS[reply.mediaType], short(reply.body, 80)].filter(Boolean).join(' ') || '(내용 없음)',
                state ? <AdminBadge label={state.label} tone={state.tone} /> : '',
                reply.reportCount ? <AdminBadge label={`${reply.reportCount}건`} tone="danger" /> : '',
              ],
            };
          })}
        />
      </AdminTableBlock>

      <AdminTableBlock title="이 팬이 받은 신고" count={data.reportsReceived.length} tone="danger" note={pendingReports ? `처리 대기 ${pendingReports}` : undefined}>
        <AdminTable
          columns={[
            { title: '신고일', flex: 1 },
            { title: '사유', flex: 1.1 },
            { title: '방', flex: 1.2 },
            { title: '신고된 답장', flex: 2.6 },
            { title: '처리', flex: 1 },
          ]}
          rows={data.reportsReceived.map((report) => ({
            key: report.id,
            cells: [
              day(report.createdAt),
              SANCTION_LABELS[report.category],
              report.message.actor.legalName,
              <View key="body">
                <ThemedText type="small">{short(report.message.body, 60) || '(내용 없음)'}</ThemedText>
                {report.reason ? <Sub>신고 메모: {short(report.reason, 60)}</Sub> : null}
              </View>,
              <AdminBadge key="status" label={REPORT_STATUS[report.status].label} tone={REPORT_STATUS[report.status].tone} />,
            ],
          }))}
        />
      </AdminTableBlock>

      <AdminTableBlock title="이 팬이 한 신고" count={data.reportsFiled.length}>
        <AdminTable
          columns={[
            { title: '신고일', flex: 1 },
            { title: '사유', flex: 1.1 },
            { title: '방', flex: 1.2 },
            { title: '신고한 메시지', flex: 2.6 },
            { title: '처리', flex: 1 },
          ]}
          rows={data.reportsFiled.map((report) => ({
            key: report.id,
            cells: [
              day(report.createdAt),
              SANCTION_LABELS[report.category],
              report.message.actor.legalName,
              <View key="body">
                <ThemedText type="small">{short(report.message.body, 60) || '(내용 없음)'}</ThemedText>
                <Sub>{report.message.senderType === 'ARTIST' ? '아티스트 메시지' : '다른 팬 답장'}</Sub>
              </View>,
              <AdminBadge key="status" label={REPORT_STATUS[report.status].label} tone={REPORT_STATUS[report.status].tone} />,
            ],
          }))}
        />
      </AdminTableBlock>

      <AdminTableBlock title="방 차단" count={data.blocks.length} tone="danger" note="그 방에만 답장 불가(구독·보기는 그대로)">
        <AdminTable
          columns={[
            { title: '차단일', flex: 1 },
            { title: '방', flex: 1.2 },
            { title: '차단한 사람', flex: 1.4 },
            { title: '사유', flex: 1.4 },
            { title: '계기가 된 답장', flex: 2.2 },
          ]}
          rows={data.blocks.map((block) => ({
            key: block.id,
            cells: [
              day(block.createdAt),
              block.actor.legalName,
              <View key="by">
                <ThemedText type="small">{block.blockedBy.displayName}</ThemedText>
                <Sub>{BLOCKER_ROLE[block.blockedBy.role] ?? ''}</Sub>
              </View>,
              block.reason ? short(block.reason, 40) : '',
              block.message ? short(block.message.body, 60) : '',
            ],
          }))}
        />
      </AdminTableBlock>

      <AdminTableBlock title="제재·운영자 작업 기록" count={data.actions.length} tone="warn">
        <AdminTable
          columns={[
            { title: '때', flex: 1.1 },
            { title: '작업', flex: 1 },
            { title: '사유·기간', flex: 1.6 },
            { title: '메모', flex: 2 },
            { title: '운영자', flex: 1 },
          ]}
          rows={data.actions.map((entry) => {
            const action = USER_ACTIONS[entry.action] ?? { label: entry.action, tone: 'muted' as const };
            const note = entry.detail && typeof entry.detail.note === 'string' ? entry.detail.note : '';
            return {
              key: entry.id,
              cells: [at(entry.createdAt), <AdminBadge key="action" label={action.label} tone={action.tone} />, actionDetail(entry), note, entry.admin.displayName],
            };
          })}
        />
      </AdminTableBlock>
    </AdminSection>
  );
}
