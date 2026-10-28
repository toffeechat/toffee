import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link2Off } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { setPendingConnect } from '@/lib/partner-connect';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

interface Preview {
  partner: string;
  name: string;
  linked: boolean;
}

function go(url: string) {
  if (Platform.OS === 'web') window.location.assign(url);
  else void Linking.openURL(url);
}

/**
 * 디저트랩 다른 서비스(검볼)에 토피 계정으로 로그인(2026-10-28) — `/connect/<client>?redirect_uri&state&code_challenge&code_challenge_method=S256`.
 * 로그인 전: 주소를 기억하고 로그인 화면으로(끝나면 AuthGate가 돌려보냄). 로그인 후: 무엇을 알려 주는지 보여 주고 동의 → 서버가 만든 1회용 코드를
 * 붙여 그 서비스로 돌아감. 취소하면 error=access_denied로 돌아감.
 */
export default function ConnectScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ clientId: string; redirect_uri?: string; state?: string; code_challenge?: string; code_challenge_method?: string }>();
  const [leaving, setLeaving] = useState(false);
  const redirectUri = params.redirect_uri ?? '';
  const wellFormed = !!redirectUri && !!params.state && !!params.code_challenge && params.code_challenge_method === 'S256';

  const preview = useQuery({
    queryKey: ['partner-preview', params.clientId, redirectUri],
    queryFn: () => apiClient.get<Preview>(`/partners/${encodeURIComponent(params.clientId)}/preview?redirectUri=${encodeURIComponent(redirectUri)}`),
    enabled: !!token && wellFormed,
    retry: false,
  });
  const authorize = useMutation({
    mutationFn: () =>
      apiClient.post<{ redirectTo: string }>('/partners/authorize', { clientId: params.clientId, redirectUri, state: params.state, codeChallenge: params.code_challenge }),
    onSuccess: ({ redirectTo }) => {
      setLeaving(true);
      go(redirectTo);
    },
  });

  // 로그인한 채로 여기 왔으면 기억해 둔 주소는 다 씀
  useEffect(() => {
    if (token) void setPendingConnect(null);
  }, [token]);

  const goLogin = async () => {
    const query = new URLSearchParams({ redirect_uri: redirectUri, state: params.state ?? '', code_challenge: params.code_challenge ?? '', code_challenge_method: 'S256' });
    await setPendingConnect(`/connect/${encodeURIComponent(params.clientId)}?${query.toString()}`);
    router.replace('/login');
  };

  const cancel = () => {
    // 등록된 주소인 게 확인됐을 때만 돌려보냄(아무 주소로나 보내지 않게)
    if (!preview.data) return router.replace('/');
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (params.state) url.searchParams.set('state', params.state);
    setLeaving(true);
    go(url.toString());
  };

  const body = (() => {
    if (!wellFormed || preview.isError) {
      return (
        <EmptyState
          icon={Link2Off}
          title={t('connect.invalidTitle')}
          body={preview.error instanceof ApiError ? preview.error.message : t('connect.invalidBody')}
          action={<Button title={t('connect.home')} variant="secondary" onPress={() => router.replace('/')} />}
        />
      );
    }
    if (leaving) return <ActivityIndicator color={theme.tint} style={styles.loading} />;
    if (!token) {
      return (
        <View style={styles.card}>
          <ThemedText type="headline" style={styles.center}>
            {t('connect.loginTitle')}
          </ThemedText>
          <ThemedText style={styles.center}>{t('connect.loginBody')}</ThemedText>
          <Button title={t('connect.loginFirst')} onPress={() => void goLogin()} style={styles.stretch} />
        </View>
      );
    }
    if (preview.isLoading || !preview.data) return <ActivityIndicator color={theme.tint} style={styles.loading} />;
    const name = preview.data.name;
    return (
      <View style={styles.card}>
        <ThemedText type="display" style={styles.center}>
          {name}
        </ThemedText>
        <ThemedText type="headline" style={styles.center}>
          {t('connect.title', { name })}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {t('connect.about', { name })}
        </ThemedText>
        <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{t('connect.sharedTitle', { name })}</ThemedText>
          <ThemedText type="small">· {t('connect.shared1')}</ThemedText>
          <ThemedText type="small">· {t('connect.shared2')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
            {t('connect.notShared')}
          </ThemedText>
        </View>
        <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
          {t('connect.revokeHint')}
        </ThemedText>
        {authorize.error ? (
          <ThemedText type="small" themeColor="danger" style={styles.center}>
            {authorize.error instanceof ApiError ? authorize.error.message : t('connect.invalidBody')}
          </ThemedText>
        ) : null}
        <Button title={t('connect.agree')} loading={authorize.isPending} onPress={() => authorize.mutate()} style={styles.stretch} />
        <Button title={t('connect.cancel')} variant="ghost" onPress={cancel} style={styles.stretch} />
      </View>
    );
  })();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: MaxContentWidth }]}>
        <BrandHeader />
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  card: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingTop: Spacing.five },
  center: { textAlign: 'center' },
  note: { borderRadius: Radius.lg, padding: Spacing.three, alignSelf: 'stretch', marginVertical: Spacing.two, gap: 4 },
  stretch: { alignSelf: 'stretch' },
  loading: { marginTop: Spacing.six },
});
