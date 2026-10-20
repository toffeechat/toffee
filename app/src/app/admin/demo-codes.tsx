import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection } from '@/components/admin-ui';
import {
  useCreateDemoCode,
  useDemoCodeEvents,
  useDemoCodes,
  useUpdateDemoCode,
  type DemoAccessEvent,
  type DemoCode,
  type DemoCodeSummary,
  type DemoRoleKey,
} from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { copyText } from '@/lib/copy-text';
import { Spacing } from '@/constants/theme';

/**
 * 소속사별 데모 입장 코드(2026-10-19 사용자 결정) — 소속사 이름·코드·만료일을 등록하고 링크를 복사해 보냄. 코드 하나로 데모의
 * [소속사][아티스트][팬] 버튼을 다 씀. 30분 넘게 쉬었다가 들어올 때마다 운영자에게 메일(서버 DEMO_ALERT_EMAIL), 여기선 첫·마지막
 * 접속·횟수·기록. 코드는 지우지 않고 중지만(기록 보존) — 중지·만료되면 로그인 중이던 사람도 1분 안에 로그아웃.
 */

const ROLE_LABELS: Record<DemoRoleKey, string> = { agency: '소속사', artist: '아티스트', fan: '팬', other: '기타' };
const LINK_ROLES: DemoRoleKey[] = ['agency', 'artist', 'fan'];
const LINK_LANGS: { value: string; label: string }[] = [
  { value: 'th', label: '태국어' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh-Hans', label: '중국어 간체' },
  { value: 'zh-Hant', label: '중국어 번체' },
  { value: 'vi', label: '베트남어' },
  { value: 'es', label: '스페인어' },
  { value: 'pt-BR', label: '포르투갈어(브라질)' },
];
const PLATFORM_LABELS: Record<string, string> = { ios: 'iOS 앱', android: '안드로이드 앱', web: '웹' };
// 웹 데모 주소 — 운영자가 웹에서 보면 지금 주소, 앱이면 데모 웹 주소
const DEMO_WEB_URL = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://demo.toffeechat.app';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** 오늘부터 days일 뒤(한국 날짜) YYYY-MM-DD */
function dateAfter(days: number): string {
  return new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → 그날 끝(한국 시간)까지 */
function endOfDayKst(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T23:59:59+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function rolesText(counts: DemoCodeSummary['roleCounts']): string {
  return (Object.keys(ROLE_LABELS) as DemoRoleKey[])
    .filter((role) => counts[role])
    .map((role) => `${ROLE_LABELS[role]} ${counts[role]}`)
    .join(' · ');
}

function eventText(event: DemoAccessEvent): string {
  const what = event.kind === 'LOGIN' ? '로그인' : event.newVisit ? '다시 들어옴' : '사용 중';
  const device = [event.platform ? (PLATFORM_LABELS[event.platform] ?? event.platform) : null, event.deviceModel, event.osVersion, event.ip]
    .filter(Boolean)
    .join(' · ');
  return `${dateTime(event.createdAt)} · ${ROLE_LABELS[event.role] ?? event.role} ${what}${device ? ` · ${device}` : ''}`;
}

function SeenLine({ summary }: { summary: DemoCodeSummary }) {
  if (!summary.lastSeenAt) {
    return (
      <ThemedText type="small" themeColor="danger">
        아직 안 들어옴
      </ThemedText>
    );
  }
  const roles = rolesText(summary.roleCounts);
  return (
    <ThemedText type="small" themeColor="textSecondary">
      마지막 접속 {timeAgo(summary.lastSeenAt)} · 첫 접속 {summary.firstSeenAt ? dateTime(summary.firstSeenAt) : '-'} · {summary.visitCount}번 들어옴
      {roles ? `\n${roles}` : ''}
    </ThemedText>
  );
}

function EventList({ id }: { id: string }) {
  const { data: events, isLoading, isError } = useDemoCodeEvents(id, true);
  if (isLoading) return <ActivityIndicator style={styles.eventsLoading} />;
  if (isError) {
    return (
      <ThemedText type="small" themeColor="danger">
        기록을 불러오지 못했어요.
      </ThemedText>
    );
  }
  if (!events?.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        최근 3개월 기록이 없어요.
      </ThemedText>
    );
  }
  return (
    <ThemedView style={styles.events}>
      {events.map((event) => (
        <ThemedText key={event.id} type="small" themeColor={event.kind === 'LOGIN' || event.newVisit ? 'text' : 'textSecondary'}>
          {eventText(event)}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

function CodeRow({ item, linkRole, linkLang }: { item: DemoCode; linkRole: DemoRoleKey; linkLang: string }) {
  const theme = useTheme();
  const updateCode = useUpdateDemoCode();
  const [showEvents, setShowEvents] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiry, setExpiry] = useState(kstDate(item.expiresAt));
  const [message, setMessage] = useState<string | null>(null);
  const link = `${DEMO_WEB_URL}/?demo=${encodeURIComponent(item.code)}&as=${linkRole}&lang=${linkLang}`;

  const saveExpiry = () => {
    const expiresAt = endOfDayKst(expiry.trim());
    if (!expiresAt) return setMessage('날짜를 YYYY-MM-DD로 입력해 주세요.');
    updateCode.mutate(
      { id: item.id, expiresAt },
      { onSuccess: () => (setEditingExpiry(false), setMessage(null)), onError: (e) => setMessage(errorText(e, '저장하지 못했어요.')) },
    );
  };

  const toggleRevoked = async () => {
    const revoking = item.status !== 'REVOKED';
    if (
      revoking &&
      !(await confirm('사용 중지', `${item.agencyName} 입장 코드를 중지할까요? 지금 들어와 있는 사람도 1분 안에 로그아웃돼요.`, '중지', '취소'))
    ) {
      return;
    }
    updateCode.mutate({ id: item.id, revoked: revoking }, { onError: (e) => setMessage(errorText(e, '저장하지 못했어요.')) });
  };

  const statusText = item.status === 'REVOKED' ? '중지됨' : item.status === 'EXPIRED' ? '만료됨' : '사용 중';

  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={styles.rowBody}>
        <ThemedText type="smallBold">{item.agencyName}</ThemedText>
        <ThemedText type="small" themeColor={item.status === 'ACTIVE' ? 'textSecondary' : 'danger'}>
          {item.code} · {statusText} · {kstDate(item.expiresAt)}까지
        </ThemedText>
        {item.note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {item.note}
          </ThemedText>
        ) : null}
        <SeenLine summary={item} />
      </ThemedView>
      {editingExpiry ? (
        <>
          <AdminField label="만료일(한국 날짜, 그날 끝까지)" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" maxLength={10} />
          <ThemedView style={styles.chips}>
            <AdminChip label="+2주" onPress={() => setExpiry(dateAfter(14))} />
            <AdminChip label="+1개월" onPress={() => setExpiry(dateAfter(30))} />
            <AdminChip label="+3개월" onPress={() => setExpiry(dateAfter(90))} />
            <AdminChip label="저장" selected disabled={updateCode.isPending} onPress={saveExpiry} />
            <AdminChip label="취소" onPress={() => (setEditingExpiry(false), setExpiry(kstDate(item.expiresAt)))} />
          </ThemedView>
        </>
      ) : (
        <ThemedView style={styles.chips}>
          <AdminChip label="링크 복사" disabled={item.status !== 'ACTIVE'} onPress={() => copyText(link)} />
          <AdminChip label="코드 복사" onPress={() => copyText(item.code)} />
          <AdminChip label={showEvents ? '기록 닫기' : '접속 기록'} selected={showEvents} onPress={() => setShowEvents(!showEvents)} />
          <AdminChip label="만료일 변경" onPress={() => setEditingExpiry(true)} />
          <AdminChip
            label={item.status === 'REVOKED' ? '다시 사용' : '사용 중지'}
            danger={item.status !== 'REVOKED'}
            disabled={updateCode.isPending}
            onPress={toggleRevoked}
          />
        </ThemedView>
      )}
      <AdminMessage text={message} error />
      {showEvents ? <EventList id={item.id} /> : null}
    </ThemedView>
  );
}

function CommonRow({ summary }: { summary: DemoCodeSummary }) {
  const theme = useTheme();
  const [showEvents, setShowEvents] = useState(false);
  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={styles.rowBody}>
        <ThemedText type="smallBold">공용 코드(내부)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          서버 DEV_LOGIN_CODE — 내부 테스트용, 메일 안 보냄
        </ThemedText>
        <SeenLine summary={summary} />
      </ThemedView>
      <ThemedView style={styles.chips}>
        <AdminChip label={showEvents ? '기록 닫기' : '접속 기록'} selected={showEvents} onPress={() => setShowEvents(!showEvents)} />
      </ThemedView>
      {showEvents ? <EventList id="common" /> : null}
    </ThemedView>
  );
}

export default function AdminDemoCodesScreen() {
  const theme = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useDemoCodes();
  const createCode = useCreateDemoCode();
  const [agencyName, setAgencyName] = useState('');
  const [code, setCode] = useState('');
  const [expiry, setExpiry] = useState(() => dateAfter(30));
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState<DemoRoleKey>('agency');
  const [linkLang, setLinkLang] = useState('th');

  const create = () => {
    if (!agencyName.trim()) return setMessage('소속사 이름을 입력해 주세요.');
    const expiresAt = endOfDayKst(expiry.trim());
    if (!expiresAt) return setMessage('만료일을 YYYY-MM-DD로 입력해 주세요.');
    createCode.mutate(
      { agencyName: agencyName.trim(), expiresAt, ...(code.trim() ? { code: code.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: (row) => {
          setAgencyName('');
          setCode('');
          setNote('');
          setExpiry(dateAfter(30));
          setMessage(null);
          setCreated(`${row.agencyName} 코드: ${row.code}`);
        },
        onError: (e) => setMessage(errorText(e, '등록하지 못했어요.')),
      },
    );
  };

  const header = (
    <ThemedView style={styles.header}>
      <AdminSection
        title="입장 코드 등록"
        hint="코드 하나로 데모의 소속사·아티스트·팬 버튼을 다 써요. 30분 넘게 쉬었다가 들어올 때마다 운영자에게 메일이 가요. 코드를 비우면 자동으로 만들어요.">
        <AdminField label="소속사 이름" value={agencyName} onChangeText={setAgencyName} maxLength={100} />
        <AdminField
          label="입장 코드(영문 소문자·숫자·하이픈 4~32자, 비우면 자동)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
        />
        <AdminField label="만료일(한국 날짜, 그날 끝까지)" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" maxLength={10} />
        <ThemedView style={styles.chips}>
          <AdminChip label="2주" onPress={() => setExpiry(dateAfter(14))} />
          <AdminChip label="1개월" onPress={() => setExpiry(dateAfter(30))} />
          <AdminChip label="3개월" onPress={() => setExpiry(dateAfter(90))} />
        </ThemedView>
        <AdminField label="메모(담당자·보낸 날 등, 선택)" value={note} onChangeText={setNote} maxLength={500} />
        <AdminMessage text={message} error />
        <AdminMessage text={created} />
        <AdminButton label={createCode.isPending ? '등록하는 중…' : '등록'} disabled={createCode.isPending || !agencyName.trim()} onPress={create} />
      </AdminSection>
      <AdminSection title="링크 설정" hint="[링크 복사]로 만드는 주소 — 누르면 입력 없이 그 화면·언어로 바로 들어가요.">
        <ThemedView style={styles.chips}>
          {LINK_ROLES.map((role) => (
            <AdminChip key={role} label={`${ROLE_LABELS[role]} 화면`} selected={linkRole === role} onPress={() => setLinkRole(role)} />
          ))}
        </ThemedView>
        <ThemedView style={styles.chips}>
          {LINK_LANGS.map((lang) => (
            <AdminChip key={lang.value} label={lang.label} selected={linkLang === lang.value} onPress={() => setLinkLang(lang.value)} />
          ))}
        </ThemedView>
      </AdminSection>
      <ThemedView style={styles.chips}>
        <AdminChip label={isRefetching ? '새로고침 중…' : '새로고침'} disabled={isRefetching} onPress={() => void refetch()} />
      </ThemedView>
    </ThemedView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={data?.codes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <ThemedText type="small" themeColor={isError ? 'danger' : 'textSecondary'} style={styles.empty}>
              {isError ? '목록을 불러오지 못했어요.' : '등록된 입장 코드가 없어요.'}
            </ThemedText>
          }
          ListFooterComponent={data?.common ? <CommonRow summary={data.common} /> : null}
          renderItem={({ item }) => <CodeRow item={item} linkRole={linkRole} linkLang={linkLang} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.three, backgroundColor: 'transparent' },
  row: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  rowBody: { gap: 2, backgroundColor: 'transparent' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  events: { gap: 4, backgroundColor: 'transparent' },
  eventsLoading: { marginVertical: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
