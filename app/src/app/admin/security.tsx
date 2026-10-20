import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { AdminButton, AdminButtonRow, AdminChip, AdminField, AdminMessage, AdminSection } from '@/components/admin-ui';
import {
  useAdminAccounts,
  useAdminMfaAction,
  useAdminMfaSetup,
  useAdminMfaStatus,
  useResetAdminMfa,
  useSetAdminLevel,
  type AdminAccount,
  type AdminLevel,
} from '@/hooks/use-admin';
import { useMe } from '@/hooks/use-onboarding';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { confirm } from '@/lib/confirm';
import { copyText } from '@/lib/copy-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const LEVEL_LABEL: Record<AdminLevel, string> = { OWNER: '전체 권한', SUPPORT: '고객 응대' };
const LEVEL_HINT: Record<AdminLevel, string> = {
  OWNER: '모든 메뉴',
  SUPPORT: '회원 제재·신고·금칙어·공지·환불·1:1 문의·통계 보기만(아티스트·묶음·소속사·정산·앱 설정·아티스트로 글쓰기 안 됨)',
};
const errorText = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

/**
 * 보안·운영자(2026-10-20) — ① 내 2단계 인증(인증 앱 6자리 코드, 켜면 로그인 뒤·12시간마다 코드) ② 전체 권한 운영자만: 운영자 목록, 권한 단계 바꾸기,
 * 폰 잃어버린 운영자의 2단계 인증 초기화. 운영자 계정 자체는 지금처럼 따로 만듦(회원 관리에서 운영자로 바꾸는 기능은 없음).
 */
export default function AdminSecurityScreen() {
  const { data: me } = useMe();
  const isOwner = me?.adminLevel !== 'SUPPORT';
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MfaSection />
        {me ? (
          <AdminSection title="내 권한" hint={LEVEL_HINT[me.adminLevel ?? 'OWNER']}>
            <ThemedText type="smallBold">{LEVEL_LABEL[me.adminLevel ?? 'OWNER']}</ThemedText>
          </AdminSection>
        ) : null}
        {isOwner ? <AdminsSection myId={me?.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MfaSection() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { login } = useAuth();
  const { data: status, isLoading } = useAdminMfaStatus();
  const setup = useAdminMfaSetup();
  const enable = useAdminMfaAction('enable');
  const disable = useAdminMfaAction('disable');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const busy = setup.isPending || enable.isPending || disable.isPending;

  const afterToken = async (accessToken: string, text: string) => {
    await login(accessToken);
    setup.reset();
    setCode('');
    setNotice({ text });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'mfa'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };
  const onError = (e: unknown) => setNotice({ text: errorText(e, '코드가 맞지 않아요.'), error: true });

  const codeField = (
    <AdminField
      label="인증 앱의 6자리 코드"
      value={code}
      onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      placeholder="000000"
    />
  );

  if (isLoading || !status) return <ActivityIndicator color={theme.tint} />;

  if (status.enabled) {
    const turnOff = async () => {
      if (code.length !== 6) return setNotice({ text: '끄려면 지금 코드를 넣어 주세요.', error: true });
      if (await confirm('2단계 인증 끄기', '끄면 비밀번호(로그인)만으로 운영자 화면에 들어올 수 있어요. 끌까요?', '끄기', '취소')) {
        disable.mutate(code, { onSuccess: ({ accessToken }) => void afterToken(accessToken, '2단계 인증을 껐어요.'), onError });
      }
    };
    return (
      <AdminSection title="2단계 인증" hint="켜져 있어요. 로그인한 뒤와 12시간마다 인증 앱 코드를 물어요.">
        <ThemedText type="smallBold">켜짐{status.enabledAt ? ` · ${new Date(status.enabledAt).toLocaleDateString('ko-KR')}부터` : ''}</ThemedText>
        {codeField}
        <AdminButtonRow>
          <AdminButton secondary label={disable.isPending ? '끄는 중…' : '2단계 인증 끄기'} disabled={busy || code.length !== 6} onPress={() => void turnOff()} />
        </AdminButtonRow>
        <AdminMessage text={notice?.text ?? null} error={notice?.error} />
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title="2단계 인증"
      hint="운영자 계정은 회원 제재·환불·정산을 할 수 있어서 켜 두길 권해요. 휴대폰 인증 앱(Google Authenticator, 1Password 등)이 필요해요.">
      <ThemedText type="smallBold" themeColor="danger">
        꺼짐
      </ThemedText>
      {!setup.data ? (
        <AdminButtonRow>
          <AdminButton label={setup.isPending ? '준비하는 중…' : '2단계 인증 설정'} disabled={busy} onPress={() => setup.mutate(undefined, { onError })} />
        </AdminButtonRow>
      ) : (
        <>
          <ThemedText type="small">
            1. 인증 앱에서 “키 직접 입력”을 고르고 아래 키를 넣어요{Platform.OS === 'web' ? '' : '(또는 [인증 앱에 추가])'}.
          </ThemedText>
          <View style={[styles.secret, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" selectable style={styles.secretText}>
              {setup.data.secret.replace(/(.{4})/g, '$1 ').trim()}
            </ThemedText>
          </View>
          <AdminButtonRow>
            <AdminButton secondary label="키 복사" onPress={() => copyText(setup.data!.secret)} />
            {Platform.OS !== 'web' ? <AdminButton secondary label="인증 앱에 추가" onPress={() => void Linking.openURL(setup.data!.otpauthUrl).catch(() => {})} /> : null}
          </AdminButtonRow>
          <ThemedText type="small">2. 인증 앱에 보이는 6자리 코드를 넣고 [켜기]를 눌러요.</ThemedText>
          {codeField}
          <AdminButtonRow>
            <AdminButton
              label={enable.isPending ? '확인하는 중…' : '켜기'}
              disabled={busy || code.length !== 6}
              onPress={() => enable.mutate(code, { onSuccess: ({ accessToken }) => void afterToken(accessToken, '2단계 인증을 켰어요.'), onError })}
            />
          </AdminButtonRow>
        </>
      )}
      <AdminMessage text={notice?.text ?? null} error={notice?.error} />
    </AdminSection>
  );
}

function AdminsSection({ myId }: { myId?: string }) {
  const theme = useTheme();
  const { data: admins, isLoading } = useAdminAccounts(true);
  return (
    <AdminSection title="운영자" hint="권한 단계를 바꾸거나, 휴대폰을 잃어버린 운영자의 2단계 인증을 초기화해요. 전체 권한 운영자는 최소 1명 남아야 해요.">
      {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
      {(admins ?? []).map((admin) => (
        <AdminRow key={admin.id} admin={admin} isMe={admin.id === myId} />
      ))}
    </AdminSection>
  );
}

function AdminRow({ admin, isMe }: { admin: AdminAccount; isMe: boolean }) {
  const theme = useTheme();
  const setLevel = useSetAdminLevel();
  const reset = useResetAdminMfa();
  const name = admin.nickname ?? admin.displayName;
  const error = setLevel.error ?? reset.error;

  const changeLevel = async (level: AdminLevel) => {
    if (level === admin.level) return;
    const ok = await confirm('권한 단계 바꾸기', `${name}을(를) "${LEVEL_LABEL[level]}"로 바꿀까요?\n\n${LEVEL_HINT[level]}`, '바꾸기', '취소');
    if (ok) setLevel.mutate({ id: admin.id, level });
  };
  const resetMfa = async () => {
    if (await confirm('2단계 인증 초기화', `${name}의 2단계 인증을 꺼요. 본인 확인을 한 뒤에만 하세요. 다음 로그인 때 다시 설정해야 해요.`, '초기화', '취소')) reset.mutate(admin.id);
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.background }]}>
      <ThemedText type="smallBold">
        {name}
        {isMe ? ' (나)' : ''}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {admin.email ?? '이메일 없음'} · 2단계 인증 {admin.mfaEnabled ? '켜짐' : '꺼짐'}
        {admin.status !== 'ACTIVE' ? ` · ${admin.status}` : ''}
      </ThemedText>
      <View style={styles.chips}>
        {(Object.keys(LEVEL_LABEL) as AdminLevel[]).map((level) => (
          <AdminChip key={level} label={LEVEL_LABEL[level]} selected={admin.level === level} disabled={setLevel.isPending} onPress={() => void changeLevel(level)} />
        ))}
        {admin.mfaEnabled && !isMe ? <AdminChip label="2단계 인증 초기화" danger disabled={reset.isPending} onPress={() => void resetMfa()} /> : null}
      </View>
      <AdminMessage text={error ? errorText(error, '바꾸지 못했어요.') : null} error />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  secret: { borderRadius: 10, padding: Spacing.three },
  secretText: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), letterSpacing: 1 },
  row: { borderRadius: 12, padding: Spacing.three, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 4 },
});
