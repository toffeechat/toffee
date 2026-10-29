import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminField, AdminMessage, AdminSection } from '@/components/admin-ui';
import { AdminDateField } from '@/components/admin-date-field';
import { useAdminAppSettings, useUpdateAppSettings, type AdminAppSettings } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { formatBangkokDateTime, parseBangkokDateTime } from '@/utils/release';
import { thaiToday } from '@/utils/stat-range';

const VERSION = /^\d+(\.\d+){0,2}$/;

/**
 * 앱 설정(2026-10-20, 전체 권한 운영자만) — 점검 모드: 켜면 운영자 말고는 앱·웹이 점검 화면, 서버도 운영자 아닌 요청을 막음(결제 알림·로그인은 열어 둠).
 * 끝 시각을 넣으면 그때 저절로 풀림. 앱 최소 버전: 그보다 낮은 앱은 업데이트 화면(웹은 해당 없음).
 */
export default function AdminAppSettingsScreen() {
  const theme = useTheme();
  const { data, isLoading } = useAdminAppSettings();
  // 처음 DB엔 설정 줄이 없어 서버가 null을 줌(처음 저장할 때 생김) — 그땐 기본값으로 폼을 보여 줌(2026-10-29, 예전엔 스피너만 계속)
  if (isLoading) return <ActivityIndicator style={styles.loading} color={theme.tint} />;
  return <AppSettingsForm data={data ?? DEFAULT_SETTINGS} />;
}

const DEFAULT_SETTINGS: AppSettingsValues = { maintenanceOn: false, maintenanceMessage: null, maintenanceUntil: null, minVersionIos: null, minVersionAndroid: null };
type AppSettingsValues = Omit<AdminAppSettings, 'updatedAt'>;

// 입력칸은 처음 받은 값으로 시작(저장하면 서버 값이 바뀌어도 입력 중인 글자는 그대로)
function AppSettingsForm({ data }: { data: AppSettingsValues }) {
  const theme = useTheme();
  const update = useUpdateAppSettings();
  const [message, setMessage] = useState(data.maintenanceMessage ?? '');
  // 이미 지난 끝 시각은 비운 채로 시작(2026-10-29 — 그대로 다시 켜면 서버가 바로 끝난 것으로 봐서 점검이 안 걸렸음)
  const [until, setUntil] = useState(data.maintenanceUntil && new Date(data.maintenanceUntil) > new Date() ? formatBangkokDateTime(data.maintenanceUntil) : '');
  const [ios, setIos] = useState(data.minVersionIos ?? '');
  const [android, setAndroid] = useState(data.minVersionAndroid ?? '');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const on = !!data?.maintenanceOn && (!data.maintenanceUntil || new Date(data.maintenanceUntil) > new Date());
  const onError = (e: unknown) => setNotice({ text: e instanceof ApiError ? e.message : '저장하지 못했어요.', error: true });
  const untilIso = until ? parseBangkokDateTime(until) : null;
  // 끝 시각이 지금이거나 이미 지났으면 막음(2026-10-29 — 저장돼도 점검이 바로 풀린 상태라 운영자가 켠 줄 착각)
  const untilPast = () => {
    if (untilIso && new Date(untilIso) <= new Date()) {
      setNotice({ text: '끝나는 시각이 이미 지났어요. 지금보다 뒤로 고르거나 비워 주세요.', error: true });
      return true;
    }
    return false;
  };

  const toggle = async () => {
    const turningOn = !on;
    if (turningOn && untilPast()) return;
    const ok = await confirm(
      turningOn ? '점검 모드 켜기' : '점검 모드 끄기',
      turningOn
        ? '지금부터 운영자 말고는 앱·웹에서 점검 화면만 보여요(아티스트 메시지 발송·팬 답장도 멈춤). 스토어 결제 알림은 계속 받아요.'
        : '점검을 끝내고 모두 다시 쓸 수 있게 할까요?',
      turningOn ? '켜기' : '끄기',
      '취소',
    );
    if (!ok) return;
    update.mutate(
      turningOn ? { maintenanceOn: true, maintenanceMessage: message || null, maintenanceUntil: untilIso } : { maintenanceOn: false },
      { onSuccess: () => setNotice({ text: turningOn ? '점검 모드를 켰어요.' : '점검 모드를 껐어요.' }), onError },
    );
  };
  const saveVersions = () => {
    if ((ios && !VERSION.test(ios)) || (android && !VERSION.test(android))) return setNotice({ text: '버전은 "1.2.0"처럼 넣어 주세요.', error: true });
    update.mutate({ minVersionIos: ios || null, minVersionAndroid: android || null }, { onSuccess: () => setNotice({ text: '최소 버전을 저장했어요.' }), onError });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminSection title="점검 모드" hint="서버 작업·큰 장애 때. 켜는 동안 운영자 말고는 점검 화면만 보이고 서버도 막아요. 끝 시각을 넣으면 그때 저절로 풀려요.">
          <View style={styles.switchRow}>
            <ThemedText type="smallBold" themeColor={on ? 'danger' : 'text'} style={styles.flex}>
              {on ? '점검 중' : '꺼짐'}
            </ThemedText>
            <Switch value={on} onValueChange={() => void toggle()} disabled={update.isPending} trackColor={{ true: theme.danger, false: theme.border }} thumbColor="#ffffff" />
          </View>
          <AdminField label="안내 문구(선택, 한국어 — 앱은 번역된 기본 문구와 함께 보여 줘요)" value={message} onChangeText={setMessage} maxLength={500} placeholder="예: 10월 21일 새벽 2시~4시 서버 이전" />
          <AdminDateField label="끝나는 시각(선택, 태국 시간)" value={until} onChange={setUntil} withTime min={thaiToday()} clearable />
          {on ? (
            <AdminButtonRow>
              <AdminButton
                secondary
                label="안내·끝 시각만 바꾸기"
                disabled={update.isPending}
                onPress={() => !untilPast() && update.mutate({ maintenanceMessage: message || null, maintenanceUntil: untilIso }, { onSuccess: () => setNotice({ text: '저장했어요.' }), onError })}
              />
            </AdminButtonRow>
          ) : null}
        </AdminSection>

        <AdminSection title="앱 최소 버전" hint={`이 버전보다 낮은 앱은 "업데이트해 주세요" 화면만 보여요(비우면 검사 안 함). 스토어에 새 버전이 올라간 뒤에 올려야 해요. 지금 이 기기 앱: ${Constants.expoConfig?.version ?? '-'}`}>
          <AdminField label="iOS 최소 버전" value={ios} onChangeText={setIos} placeholder="예: 1.2.0" autoCapitalize="none" />
          <AdminField label="안드로이드 최소 버전" value={android} onChangeText={setAndroid} placeholder="예: 1.2.0" autoCapitalize="none" />
          <AdminButtonRow>
            <AdminButton label={update.isPending ? '저장 중…' : '최소 버전 저장'} disabled={update.isPending} onPress={saveVersions} />
          </AdminButtonRow>
        </AdminSection>
        <AdminMessage text={notice?.text ?? null} error={notice?.error} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  loading: { marginTop: Spacing.six },
});
