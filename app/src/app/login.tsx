import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Compass, Image as ImageIcon, MessageCircle, Sparkle, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import type { SocialCredential } from '@/lib/social-types';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { saveLastLoginProvider } from '@/lib/last-login';
import { DEMO_ROLE_EMAILS, DEMO_ROLES, loadDemoPrefs, peekDemoLink, saveDemoPrefs, SHOW_DEV_LOGIN, takeDemoLink, type DemoRole } from '@/lib/demo-entry';
import { Radius, Spacing } from '@/constants/theme';

/**
 * 첫 화면(2026-10-02 A안: 밝은 화면 — 흰색에서 아래로 연한 라벤더, 검은 워드마크, 앱 안 화면과 같은 톤. 예전 어두운 사진 배경은 칙칙하다는
 * 의견으로 바꿈) + 공식 슬로건 "Closer to what matters"(2026-10-02: 모든 언어에서 영어 그대로 — 슬로건은 번역하지 않음)와
 * DESIGN_GUIDE §3 온보딩 목표: 배우를 찾고 → 구독하면 DM이 열리고 → 사진·음성·영상이 오고 → 유료라는 걸 한눈에.
 * 로그인: 소셜 로그인(키가 설정된 것만 — 앱은 애플·구글·LINE·카카오·네이버, PC 웹은 구글, 2026-09-29) + 개발용 이메일 로그인(개발 빌드나
 * EXPO_PUBLIC_ENABLE_DEV_LOGIN=true일 때만 — 운영 빌드엔 안 보임, 서버도 운영에선 막음). 2026-10-15부터 데모 로그인은 역할 버튼 + 입장 코드,
 * 웹 링크 `?demo=코드&as=역할`이면 입력 없이 바로(`@/lib/demo-entry`).
 */

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, signedOutReason } = useAuth();
  // 데모 로그인(2026-10-15): 역할을 고르면 정해진 데모 계정으로 — 'email'은 이메일을 직접 쳐서(새 팬 가입 확인·e2e용)
  const [demoChoice, setDemoChoice] = useState<DemoRole | 'email'>(() => peekDemoLink()?.role ?? 'agency');
  const [email, setEmail] = useState('');
  // 데모 서버 입장 코드(2026-10-01) — 서버에 DEV_LOGIN_CODE가 있을 때만 필요, 로컬 개발은 비워 둠
  const [code, setCode] = useState(() => (peekDemoLink()?.role !== 'admin' ? (peekDemoLink()?.code ?? '') : ''));
  // 운영자 코드는 칸을 따로 — 기억해 둔 소속사용 코드가 운영자 칸에 채워져 있지 않게
  const [adminCode, setAdminCode] = useState(() => (peekDemoLink()?.role === 'admin' ? (peekDemoLink()?.code ?? '') : ''));
  const codeValue = demoChoice === 'admin' ? adminCode : code;
  // 운영자 버튼은 숨겨 둠 — 소속사에 보내는 화면에 "운영자"가 보이지 않게. 주소에 `?as=admin`을 붙이거나 개발 빌드면 보임
  const [showAdmin] = useState(() => __DEV__ || peekDemoLink()?.role === 'admin');
  const loginEmail = demoChoice === 'email' ? email.trim() : DEMO_ROLE_EMAILS[demoChoice];

  const devLogin = useMutation({
    mutationFn: (input: { email: string; code: string; role: DemoRole | null }) =>
      apiClient.post<{ accessToken: string }>('/auth/dev-login', { email: input.email, ...(input.code.trim() ? { code: input.code.trim() } : {}) }),
    onSuccess: async (data, input) => {
      await saveDemoPrefs(input.role, input.code.trim());
      return login(data.accessToken);
    },
  });
  const submitDevLogin = () => {
    if (!loginEmail.includes('@')) return;
    devLogin.mutate({ email: loginEmail, code: codeValue, role: demoChoice === 'email' ? null : demoChoice });
  };

  // 링크(`?demo=코드&as=역할`)로 들어왔으면 바로 로그인, 아니면 지난번 입장 코드·역할을 채워 둠
  useEffect(() => {
    if (!SHOW_DEV_LOGIN) return;
    const link = takeDemoLink();
    if (link?.role && link.code) {
      devLogin.mutate({ email: DEMO_ROLE_EMAILS[link.role], code: link.code, role: link.role });
      return;
    }
    void loadDemoPrefs().then((saved) => {
      if (saved.code) setCode((current) => current || saved.code!);
      if (!link?.role && saved.role) setDemoChoice(saved.role);
    });
    // 첫 화면에서 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 소셜 로그인 — SDK에서 받은 토큰을 서버가 그 회사 API로 다시 확인하고 우리 로그인 토큰을 줌
  const [socialError, setSocialError] = useState<string | null>(null);
  const socialLogin = useMutation({
    mutationFn: (credential: SocialCredential) => apiClient.post<{ accessToken: string }>(`/auth/${credential.provider}`, credential.body),
    onSuccess: (data, credential) => {
      saveLastLoginProvider(credential.provider);
      return login(data.accessToken);
    },
  });
  // mutate·setState는 렌더마다 같은 함수 — 웹 구글 버튼이 매번 다시 그려지지 않게 그대로 넘김
  const onCredential = socialLogin.mutate;
  const error = socialLogin.isError
    ? socialLogin.error instanceof ApiError
      ? socialLogin.error.message
      : t('login.failed')
    : devLogin.isError
      ? devLogin.error instanceof ApiError
        ? devLogin.error.message
        : t('login.failed')
      : (socialError ?? signedOutReason);

  const points: { icon: LucideIcon; text: string }[] = [
    { icon: Compass, text: t('welcome.discover') },
    { icon: MessageCircle, text: t('welcome.dm') },
    { icon: ImageIcon, text: t('welcome.media') },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FFFFFF', '#F4F6FB', '#DCE1FF']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Image source={require('@/../assets/brand/wordmark-black.png')} style={styles.wordmark} contentFit="contain" accessibilityLabel="Toffee" />
              <ThemedText type="display" style={styles.headline}>
                {t('welcome.headline')}
              </ThemedText>
              <View style={styles.points}>
                {points.map((point) => (
                  <View key={point.text} style={styles.point}>
                    <View style={styles.pointIcon}>
                      <Icon as={point.icon} size={18} color="#5566E8" />
                    </View>
                    <ThemedText style={styles.pointText}>{point.text}</ThemedText>
                  </View>
                ))}
              </View>
              <View style={styles.paid}>
                <Icon as={Sparkle} size={14} color="#7C8CFF" fill="#7C8CFF" />
                <ThemedText type="small" style={styles.paidText}>
                  {t('welcome.paid')}
                </ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <SocialLoginButtons onCredential={onCredential} onError={setSocialError} busy={socialLogin.isPending} />
              {socialLogin.isPending ? (
                <ThemedText type="small" style={styles.cardHint}>
                  {t('login.signingIn')}
                </ThemedText>
              ) : null}
              {!SHOW_DEV_LOGIN && error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
            </View>

            {SHOW_DEV_LOGIN ? (
            <View style={styles.card}>
              <ThemedText type="headline" style={styles.cardTitle}>
                {t('welcome.devTitle')}
              </ThemedText>
              <ThemedText type="small" style={styles.cardHint}>
                {t('welcome.devHint')}
              </ThemedText>
              <View style={styles.roles}>
                {DEMO_ROLES.filter((role) => role !== 'admin' || showAdmin).map((role) => (
                  <Chip key={role} label={t(`welcome.demoRole.${role}`)} selected={demoChoice === role} onPress={() => setDemoChoice(role)} />
                ))}
                <Chip label={t('welcome.demoRole.email')} selected={demoChoice === 'email'} onPress={() => setDemoChoice('email')} />
              </View>
              {demoChoice === 'email' ? (
                <TextField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  accessibilityLabel={t('welcome.email')}
                  style={styles.cardInput}
                  placeholderTextColor="rgba(15,17,21,0.5)"
                />
              ) : null}
              <TextField
                value={codeValue}
                onChangeText={demoChoice === 'admin' ? setAdminCode : setCode}
                placeholder={t(demoChoice === 'admin' ? 'welcome.adminCode' : 'welcome.code')}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={demoChoice === 'admin'}
                accessibilityLabel={t('welcome.code')}
                style={styles.cardInput}
                placeholderTextColor="rgba(15,17,21,0.5)"
                onSubmitEditing={submitDevLogin}
              />
              <Button
                title={t('welcome.continue')}
                variant="accent"
                loading={devLogin.isPending}
                disabled={!loginEmail.includes('@')}
                onPress={submitDevLogin}
              />
              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
            </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between', padding: Spacing.four, width: '100%', maxWidth: 520, alignSelf: 'center', gap: Spacing.five },
  hero: { paddingTop: Spacing.five, gap: Spacing.four },
  wordmark: { width: 150, height: 48 },
  headline: { color: '#0F1115', fontSize: 32, lineHeight: 42 },
  points: { gap: Spacing.three, marginTop: Spacing.two },
  point: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pointIcon: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: '#DCE1FF', alignItems: 'center', justifyContent: 'center' },
  pointText: { color: '#3A3E48', flex: 1 },
  paid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paidText: { color: '#6B6F7A' },
  actions: { gap: Spacing.two },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9ECF3', borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.three },
  cardTitle: { color: '#0F1115' },
  cardHint: { color: '#6B6F7A', marginTop: -Spacing.two },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cardInput: { backgroundColor: '#F4F6FB', color: '#0F1115' },
  error: { color: '#E5484D' },
});
