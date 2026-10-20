import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useAdminMfaAction } from '@/hooks/use-admin';
import { ApiError, onMfaRequired } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/**
 * 운영자 2단계 인증 코드 화면(2026-10-20) — 2단계 인증을 켠 운영자가 로그인했거나 확인한 지 ADMIN_MFA_HOURS(기본 12시간)가 지나서
 * 서버가 401 ADMIN_MFA_REQUIRED를 주면 화면 전체를 덮음. 코드가 맞으면 새 토큰으로 바꾸고 화면을 다시 불러옴. 운영자 전용이라 한국어만.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { login, logout, token } = useAuth();
  const [needed, setNeeded] = useState(false);
  const [code, setCode] = useState('');
  const verify = useAdminMfaAction('verify');

  useEffect(() => {
    onMfaRequired(() => setNeeded(true));
    return () => onMfaRequired(null);
  }, []);

  if (!needed || !token) return <>{children}</>;

  const submit = () => {
    if (code.length !== 6) return;
    verify.mutate(code, {
      onSuccess: async ({ accessToken }) => {
        await login(accessToken);
        setNeeded(false);
        setCode('');
        void queryClient.invalidateQueries();
      },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.tintSoft }]}>
        <Icon as={ShieldCheck} size={32} color={theme.tint} />
      </View>
      <ThemedText type="subtitle" style={styles.center}>
        2단계 인증
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        인증 앱(Google Authenticator 등)에 보이는 6자리 코드를 넣어 주세요.
      </ThemedText>
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        autoFocus
        placeholder="000000"
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel="6자리 코드"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      {verify.isError ? (
        <ThemedText type="small" themeColor="danger" style={styles.center}>
          {verify.error instanceof ApiError ? verify.error.message : '확인하지 못했어요.'}
        </ThemedText>
      ) : null}
      <Button title="확인" loading={verify.isPending} disabled={code.length !== 6} onPress={submit} />
      <Button
        title="로그아웃"
        variant="ghost"
        onPress={() => {
          setNeeded(false);
          void logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'stretch', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three, maxWidth: 420, width: '100%', alignSelf: 'center' },
  iconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  center: { textAlign: 'center' },
  input: { borderRadius: 12, paddingVertical: Spacing.three, fontSize: 28, letterSpacing: 8, textAlign: 'center' },
});
