import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Link2Off } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, apiClient } from '@/lib/api-client';
import { setPendingActorLink } from '@/lib/actor-link';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

interface LinkPreview {
  state: 'VALID' | 'USED' | 'EXPIRED' | 'INVALID';
  actor?: { legalName: string; photoUrl: string | null };
  expiresAt?: string;
}

/**
 * 아티스트 계정 연결(2026-10-19) — 운영자가 만든 1회용 링크 `/link/<토큰>`. 아이디·비밀번호 대신 아티스트가 평소 쓰는 소셜 계정을 붙임.
 * 로그인 전: 누구의 링크인지 보여 주고 [로그인하고 연결하기](토큰을 기억해 두고 로그인 화면으로 — 로그인이 끝나면 AuthGate가 여기로 돌려보냄).
 * 로그인 후: "○○ 아티스트 계정으로 연결할까요?" → [연결하기] → 역할이 아티스트로 바뀌고 아티스트 화면으로.
 */
export default function ActorLinkScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token: authToken, role, logout, refreshRole } = useAuth();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [done, setDone] = useState(false);
  const preview = useQuery({ queryKey: ['actor-link', token], queryFn: () => apiClient.get<LinkPreview>(`/actor-links/${encodeURIComponent(token)}`), enabled: !!token });
  const claim = useMutation({
    mutationFn: () => apiClient.post<{ actorId: string }>(`/actor-links/${encodeURIComponent(token)}/claim`),
    onSuccess: async () => {
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
  });

  // 로그인한 채로 이 화면에 왔으면 기억해 둔 토큰은 다 씀(다시 여기로 끌려오지 않게)
  useEffect(() => {
    if (authToken) void setPendingActorLink(null);
  }, [authToken]);

  const goLogin = async () => {
    await setPendingActorLink(token);
    router.replace('/login');
  };
  // 다른 계정으로: 로그아웃하고 다시 로그인하면 여기로 돌아옴
  const switchAccount = async () => {
    await setPendingActorLink(token);
    await logout();
    router.replace('/login');
  };
  const finish = async () => {
    await refreshRole();
    router.replace('/studio');
  };

  const data = preview.data;
  const body = (() => {
    if (preview.isLoading) return <ActivityIndicator color={theme.tint} style={styles.loading} />;
    if (done) {
      return (
        <EmptyState
          icon={CircleCheck}
          title={t('actorLink.doneTitle')}
          body={t('actorLink.doneBody', { name: data?.actor?.legalName ?? '' })}
          action={<Button title={t('actorLink.start')} onPress={() => void finish()} />}
        />
      );
    }
    if (!data || data.state !== 'VALID') {
      const reason = data?.state === 'USED' ? 'used' : data?.state === 'EXPIRED' ? 'expired' : 'invalid';
      return (
        <EmptyState
          icon={Link2Off}
          title={t(`actorLink.${reason}Title`)}
          body={t(`actorLink.${reason}Body`)}
          action={
            authToken && role === 'ACTOR' && reason === 'used' ? (
              <Button title={t('actorLink.start')} onPress={() => router.replace('/studio')} />
            ) : !authToken ? (
              <Button title={t('actorLink.toLogin')} variant="secondary" onPress={() => router.replace('/login')} />
            ) : undefined
          }
        />
      );
    }
    const name = data.actor?.legalName ?? '';
    return (
      <View style={styles.card}>
        <Avatar uri={data.actor?.photoUrl ?? null} size={96} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('actorLink.eyebrow')}
        </ThemedText>
        <ThemedText type="display" style={styles.center}>
          {name}
        </ThemedText>
        {authToken ? (
          <>
            <ThemedText type="headline" style={styles.center}>
              {t('actorLink.confirm', { name })}
            </ThemedText>
            <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('actorLink.confirmHint')}
              </ThemedText>
            </View>
            {claim.error ? (
              <ThemedText type="small" themeColor="danger" style={styles.center}>
                {claim.error instanceof ApiError ? claim.error.message : t('actorLink.failed')}
              </ThemedText>
            ) : null}
            <Button title={t('actorLink.link')} loading={claim.isPending} onPress={() => claim.mutate()} style={styles.stretch} />
            <Button title={t('actorLink.otherAccount')} variant="ghost" onPress={() => void switchAccount()} style={styles.stretch} />
          </>
        ) : (
          <>
            <ThemedText style={styles.center}>{t('actorLink.intro', { name })}</ThemedText>
            <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('actorLink.how')}
              </ThemedText>
            </View>
            <Button title={t('actorLink.loginAndLink')} onPress={() => void goLogin()} style={styles.stretch} />
          </>
        )}
        {data.expiresAt ? (
          <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
            {t('actorLink.expiresAt', { date: new Date(data.expiresAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) })}
          </ThemedText>
        ) : null}
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
  note: { borderRadius: Radius.lg, padding: Spacing.three, alignSelf: 'stretch', marginVertical: Spacing.two },
  stretch: { alignSelf: 'stretch' },
  loading: { marginTop: Spacing.six },
});
