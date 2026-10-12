import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react-native';

import { availableProviders, signIn, SignInCancelledError, type SocialCredential, type SocialProvider } from '@/lib/social-sign-in';
import { Spacing } from '@/constants/theme';
import { orderedProviders } from '@/components/social-button-style';
import { SocialButton } from '@/components/social-button';
import { useLastLoginProvider } from '@/lib/last-login';

// 테스트 빌드(개발·preview)에선 실패 원인(SDK 오류 코드)을 문구 뒤에 붙임 — 2026-10-12 실기기에서 카카오·LINE이 "로그인하지 못했어요"만
// 떠서 원인(콘솔 번들 ID 등록·계정 조건)을 알 수 없었음. 운영 빌드는 일반 문구만, 원인은 Sentry로
const SHOW_ERROR_DETAIL = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_LOGIN === 'true';

function errorDetail(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const { code, message } = error as { code?: unknown; message?: unknown };
  return [code, message].filter((part) => typeof part === 'string' || typeof part === 'number').join(' · ').slice(0, 200);
}

/** 소셜 로그인 버튼들(앱) — 키가 설정된 로그인만. 받은 자격 증명을 onCredential로(서버 로그인은 화면이 함) */
export function SocialLoginButtons({
  onCredential,
  onError,
  busy,
}: {
  onCredential: (credential: SocialCredential) => void;
  onError: (message: string | null) => void;
  busy?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const last = useLastLoginProvider();
  const providers = orderedProviders(availableProviders(), i18n.language);
  if (providers.length === 0) return null;

  const start = (provider: SocialProvider) => {
    onError(null);
    setPending(provider);
    signIn(provider)
      .then(onCredential)
      .catch((error: unknown) => {
        if (error instanceof SignInCancelledError) return;
        Sentry.captureException(error, { tags: { provider } });
        const detail = SHOW_ERROR_DETAIL ? errorDetail(error) : '';
        onError(detail ? `${t('login.socialFailed')}\n(${provider}: ${detail})` : t('login.socialFailed'));
      })
      .finally(() => setPending(null));
  };

  return (
    <View style={styles.list}>
      {providers.map((provider) => (
        <SocialButton
          key={provider}
          provider={provider}
          label={t(`login.continueWith.${provider}`)}
          onPress={() => start(provider)}
          disabled={!!pending || busy}
          loading={pending === provider}
          recentLabel={provider === last ? t('login.recent') : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
});
