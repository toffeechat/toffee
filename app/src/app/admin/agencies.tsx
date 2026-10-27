import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AdminAvatar, AdminButton, AdminChip, AdminField, AdminMessage, AdminSection, pickSquarePhoto } from '@/components/admin-ui';
import {
  useAdminAgencies,
  useAgencyShareRates,
  useApplyFoundingShare,
  useCreateAgency,
  useDeleteAgencyShareRate,
  useSetAgencyShareRate,
  useUpdateAgency,
  type AdminAgency,
} from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { uploadProfileImage } from '@/lib/upload-media';
import { Spacing } from '@/constants/theme';
import { currentMonth, shiftMonth } from '@/utils/month';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 정산 배분율 이력(2026-10-27) — 정산은 결제가 속한 달의 비율로 계산(창립 파트너 70% → 13개월째 기본 60%로 바꿔도 지난 달은 70%).
 * 마감한 달까지는 못 바꾸고, 앞으로의 달은 미리 예약할 수 있음.
 */
function SharePanel({ agency, onClose }: { agency: AdminAgency; onClose: () => void }) {
  const theme = useTheme();
  const { data, isLoading, error } = useAgencyShareRates(agency.id);
  const setRate = useSetAgencyShareRate(agency.id);
  const deleteRate = useDeleteAgencyShareRate(agency.id);
  const founding = useApplyFoundingShare(agency.id);
  const [percent, setPercent] = useState('');
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [foundingFrom, setFoundingFrom] = useState(currentMonth());
  const [message, setMessage] = useState<string | null>(null);
  const busy = setRate.isPending || deleteRate.isPending || founding.isPending;
  const label = (value: number | null) => (value === null ? `기본값(${data?.defaultPercent ?? 60}%)` : `${value}%`);
  const isOpen = (month: string) => !data?.lastClosedMonth || month > data.lastClosedMonth;

  const save = async () => {
    const text = percent.trim();
    const value = text === '' ? null : Number(text);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) return setMessage('0~100 사이 정수로 입력해 주세요(비우면 기본값).');
    if (!MONTH_PATTERN.test(fromMonth.trim())) return setMessage('적용 시작 달은 2027-02처럼 입력해 주세요.');
    if (!(await confirm('배분율 바꾸기', `${agency.name}: ${fromMonth.trim()}부터 ${label(value)}로 바꿀까요? 그 전 달은 그대로예요.`, '바꾸기', '취소'))) return;
    setMessage(null);
    setRate.mutate(
      { fromMonth: fromMonth.trim(), percent: value },
      { onSuccess: () => setPercent(''), onError: (e) => setMessage(errorText(e, '저장하지 못했어요.')) },
    );
  };

  const remove = async (month: string) => {
    if (!(await confirm('배분율 줄 지우기', `${month}부터의 배분율을 지울까요? 그 달부터는 앞 줄의 비율로 돌아가요.`, '지우기', '취소'))) return;
    setMessage(null);
    deleteRate.mutate(month, { onError: (e) => setMessage(errorText(e, '지우지 못했어요.')) });
  };

  const applyFounding = async () => {
    const start = foundingFrom.trim();
    if (!MONTH_PATTERN.test(start)) return setMessage('창립 파트너 시작 달은 2027-02처럼 입력해 주세요.');
    const after = shiftMonth(start, 12);
    if (!(await confirm('창립 파트너 적용', `${agency.name}: ${start}부터 12개월 70%, ${after}부터 기본값(${data?.defaultPercent ?? 60}%)으로 두 줄을 넣을까요?`, '적용', '취소'))) return;
    setMessage(null);
    founding.mutate({ fromMonth: start }, { onError: (e) => setMessage(errorText(e, '적용하지 못했어요.')) });
  };

  if (isLoading) return <ActivityIndicator color={theme.tint} />;
  if (!data) return <AdminMessage text={errorText(error, '배분율을 불러오지 못했어요.')} error />;
  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="smallBold">
        이번 달({data.currentMonth}) 배분율 {data.currentPercent}%
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        정산은 결제가 속한 달의 비율로 계산해요(지난달 환불·조정도 그 달 비율).{' '}
        {data.lastClosedMonth ? `${data.lastClosedMonth}까지는 마감돼서 바꿀 수 없어요.` : '아직 마감한 달이 없어요.'}
      </ThemedText>
      {data.rates.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          이력 없음 — 처음부터 기본값({data.defaultPercent}%)
        </ThemedText>
      ) : (
        data.rates.map((rate) => (
          <ThemedView key={rate.fromMonth} style={styles.rateRow}>
            <ThemedText type="small" style={styles.rateText}>
              {rate.fromMonth === '2000-01' ? '처음부터' : `${rate.fromMonth}부터`} → {label(rate.percent)}
              {rate.fromMonth > data.currentMonth ? ' (예약)' : ''}
            </ThemedText>
            {isOpen(rate.fromMonth) ? <AdminChip label="지우기" danger disabled={busy} onPress={() => void remove(rate.fromMonth)} /> : null}
          </ThemedView>
        ))
      )}
      <AdminField label="배분율(%) — 스토어 수수료 뺀 금액 중 소속사 몫, 비우면 기본값" value={percent} onChangeText={setPercent} keyboardType="number-pad" maxLength={3} />
      <AdminField label="적용 시작 달(YYYY-MM, 태국 시간)" value={fromMonth} onChangeText={setFromMonth} maxLength={7} autoCapitalize="none" />
      <ThemedView style={styles.chips}>
        <AdminChip label="배분율 바꾸기" selected disabled={busy} onPress={() => void save()} />
      </ThemedView>
      <AdminField label="창립 파트너 시작 달(본 계약 시작, YYYY-MM)" value={foundingFrom} onChangeText={setFoundingFrom} maxLength={7} autoCapitalize="none" />
      <ThemedView style={styles.chips}>
        <AdminChip label="창립 파트너 적용(12개월 70% → 기본)" disabled={busy} onPress={() => void applyFounding()} />
        <AdminChip label="닫기" onPress={onClose} />
      </ThemedView>
      <AdminMessage text={message} error />
    </ThemedView>
  );
}

function AgencyRow({ agency }: { agency: AdminAgency }) {
  const theme = useTheme();
  const updateAgency = useUpdateAgency();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agency.name);
  // 정산 배분율 — 달별 이력(SharePanel), 비우면 기본값(서버 AGENCY_REVENUE_SHARE_PERCENT, 60% — 창립 파트너는 12개월 70%)
  const [editingShare, setEditingShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveName = () => {
    if (!name.trim()) return setMessage('이름을 입력해 주세요.');
    updateAgency.mutate(
      { id: agency.id, name: name.trim() },
      { onSuccess: () => setEditing(false), onError: (e) => setMessage(errorText(e, '저장하지 못했어요.')) },
    );
  };

  const changeLogo = async () => {
    const picked = await pickSquarePhoto();
    if (!picked) return;
    setBusy(true);
    setMessage(null);
    try {
      const key = await uploadProfileImage('AGENCY', agency.id, picked.uri, picked.contentType);
      await updateAgency.mutateAsync({ id: agency.id, logoUrl: key });
    } catch (e) {
      setMessage(errorText(e, '로고를 올리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const removeLogo = async () => {
    if (await confirm('로고 삭제', `${agency.name} 로고를 지울까요?`, '삭제', '취소')) {
      updateAgency.mutate({ id: agency.id, logoUrl: null }, { onError: (e) => setMessage(errorText(e, '삭제하지 못했어요.')) });
    }
  };

  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={styles.rowHeader}>
        <AdminAvatar uri={agency.logoUrl} name={agency.name} org />
        <ThemedView style={styles.rowBody}>
          <ThemedText type="smallBold">{agency.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            아티스트 {agency.actorCount}명 · 직원 {agency.staffCount}명 · 이번 달 정산 배분{' '}
            {agency.revenueSharePercent === null ? '기본값' : `${agency.revenueSharePercent}%`}
          </ThemedText>
        </ThemedView>
      </ThemedView>
      {editingShare ? (
        <SharePanel agency={agency} onClose={() => setEditingShare(false)} />
      ) : editing ? (
        <>
          <AdminField label="소속사 이름" value={name} onChangeText={setName} maxLength={100} />
          <ThemedView style={styles.chips}>
            <AdminChip label="저장" selected disabled={updateAgency.isPending} onPress={saveName} />
            <AdminChip label="취소" onPress={() => (setEditing(false), setName(agency.name))} />
          </ThemedView>
        </>
      ) : (
        <ThemedView style={styles.chips}>
          <AdminChip label="이름 바꾸기" onPress={() => setEditing(true)} />
          <AdminChip label="정산 배분율" onPress={() => setEditingShare(true)} />
          <AdminChip label={busy ? '올리는 중…' : agency.logoUrl ? '로고 바꾸기' : '로고 올리기'} disabled={busy} onPress={changeLogo} />
          {agency.logoUrl ? <AdminChip label="로고 삭제" danger disabled={busy} onPress={removeLogo} /> : null}
        </ThemedView>
      )}
      <AdminMessage text={message} error />
    </ThemedView>
  );
}

export default function AdminAgenciesScreen() {
  const theme = useTheme();
  const { data: agencies, isLoading } = useAdminAgencies();
  const createAgency = useCreateAgency();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const create = () => {
    if (!name.trim()) return;
    createAgency.mutate(name.trim(), {
      onSuccess: () => (setName(''), setMessage(null)),
      onError: (e) => setMessage(errorText(e, '등록하지 못했어요.')),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <FlatList
          data={agencies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <AdminSection
              title="소속사 등록"
              hint="로고는 등록한 뒤에 올릴 수 있어요. 직원 배정은 회원 관리에서, 아티스트 소속은 아티스트 관리에서 해요.">
              <AdminField label="소속사 이름" value={name} onChangeText={setName} maxLength={100} onSubmitEditing={create} />
              <AdminMessage text={message} error />
              <AdminButton label="등록" disabled={createAgency.isPending || !name.trim()} onPress={create} />
            </AdminSection>
          }
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              등록된 소속사가 없어요.
            </ThemedText>
          }
          renderItem={({ item }) => <AgencyRow agency={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three },
  row: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: 'transparent' },
  rowBody: { flex: 1, gap: 2, backgroundColor: 'transparent' },
  panel: { gap: Spacing.two, backgroundColor: 'transparent' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: 'transparent' },
  rateText: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, backgroundColor: 'transparent' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  loading: { marginTop: Spacing.six },
});
