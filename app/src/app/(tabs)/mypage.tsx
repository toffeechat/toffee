import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, CircleHelp, CreditCard, Download, FileText, Globe, KeyRound, LifeBuoy, LogOut, Megaphone, Moon, ShieldCheck, Sparkles } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { AppVersion } from '@/components/app-version';
import { ListRow } from '@/components/ui/list-row';
import { LogoutAllRow } from '@/components/logout-all-row';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { confirm } from '@/lib/confirm';
import { exportMyData } from '@/lib/export-my-data';
import { ApiError } from '@/lib/api-client';
import { openStoreSubscriptions } from '@/lib/store-links';
import { useMySubscriptions } from '@/hooks/use-subscriptions';
import { useDeleteAccount, useMe } from '@/hooks/use-onboarding';
import { BUSINESS_FIELDS, useBusinessInfo } from '@/hooks/use-business-info';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGE_NATIVE_NAMES } from '@/i18n/languages';
import { PROVIDER_NAMES } from '@/components/social-button-style';
import { useThemePreference } from '@/lib/theme-preference';
import { useLocalePreference } from '@/i18n/locale-preference-context';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

/**
 * Profile — DESIGN_GUIDE §10: 단순한 설정 목록. 구독 카드는 여기 늘어놓지 않고 "구독 관리"로 들어감(§11).
 * 구독 관리 · 알림 · 언어 · 결제 수단(스토어) · 고객센터 · 약관·개인정보 · 로그아웃, 맨 아래 회원 탈퇴.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  // 전자상거래법 사업자 정보 표시 — 법인 설립 후 서버 설정값(BUSINESS_*)을 넣으면 나옴(2026-10-12)
  const { data: businessInfo } = useBusinessInfo();
  const { logout } = useAuth();
  const { data: me } = useMe();
  const { data: subscriptions } = useMySubscriptions();
  const { override } = useLocalePreference();
  const themePreference = useThemePreference();
  // 가입 수단·이메일(2026-10-12 실기기: "구글로 가입했는지, 어떤 이메일인지 알 수 없음") — 처음 가입한 수단이 맨 앞
  const providers = (me?.loginProviders ?? []).map((provider) => PROVIDER_NAMES[provider]).join(' · ');
  const deleteAccount = useDeleteAccount();
  const [notice, setNotice] = useState<string | null>(null);

  const availableAt = me?.nicknameChangeAvailableAt ? new Date(me.nicknameChangeAvailableAt) : null;
  const locked = !!availableAt && availableAt > new Date();

  // 회원 탈퇴 — 되돌릴 수 없고, 스토어 구독은 앱이 끊을 수 없어서 스토어에서 먼저 해지하라고 안내(애플 가이드라인 5.1.1)
  const startDelete = async () => {
    const ok = await confirm(t('deleteAccount.title'), t('deleteAccount.body'), t('deleteAccount.confirm'), t('common.cancel'));
    if (!ok) return;
    setNotice(null);
    deleteAccount.mutate(undefined, {
      onSuccess: () => void logout(),
      onError: (e) => setNotice(e instanceof ApiError ? e.message : t('deleteAccount.failed')),
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="display" style={styles.title}>
          {t('profile.title')}
        </ThemedText>

        <View style={[styles.me, { backgroundColor: theme.backgroundElement }]}>
          <Pressable onPress={() => router.push('/settings/profile')} accessibilityRole="button" accessibilityLabel={t('profileEdit.title')}>
            <Avatar uri={me?.profileImageUrl} size={56} />
          </Pressable>
          <View style={styles.meBody}>
            <ThemedText type="headline" numberOfLines={1}>
              {me?.nickname ?? t('profile.noNickname')}
            </ThemedText>
            {me?.statusMessage ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {me.statusMessage}
              </ThemedText>
            ) : null}
            {locked && availableAt ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('nickname.nextChange', { date: availableAt.toLocaleDateString(i18n.language) })}
              </ThemedText>
            ) : null}
            <View style={styles.meLinks}>
              {!locked ? (
                <Pressable onPress={() => router.push('/settings/nickname')} hitSlop={8} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: theme.tint }}>
                    {t('profile.editNickname')}
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => router.push('/settings/profile')} hitSlop={8} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  {t('profileEdit.title')}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        <Section label={t('profile.account')}>
          <ListRow
            icon={Sparkles}
            title={t('profile.manageSubscriptions')}
            value={subscriptions ? t('profile.subscriptionCount', { count: subscriptions.length }) : undefined}
            onPress={() => router.push('/subscriptions')}
          />
          <ListRow icon={Bell} title={t('profile.notifications')} onPress={() => router.push('/settings/notifications')} />
          <ListRow
            icon={Globe}
            title={t('profile.language')}
            value={override ? LANGUAGE_NATIVE_NAMES[override] : t('profile.languageSystem')}
            onPress={() => router.push('/settings/language')}
          />
          <ListRow
            icon={Moon}
            title={t('themeMode.title')}
            value={t(`themeMode.${themePreference}`)}
            onPress={() => router.push('/settings/theme')}
          />
          {providers ? <ListRow icon={KeyRound} title={t('profile.loginInfo')} value={providers} subtitle={me?.email ?? t('profile.noEmail')} showChevron={false} /> : null}
          <ListRow icon={CreditCard} title={t('profile.paymentMethod')} subtitle={t('profile.paymentMethodHint')} onPress={() => void openStoreSubscriptions().catch(() => {})} />
        </Section>

        <Section label={t('profile.support')}>
          <ListRow icon={Megaphone} title={t('notices.title')} onPress={() => router.push('/notices')} />
          <ListRow icon={CircleHelp} title={t('faq.title')} onPress={() => router.push('/faq')} />
          {/* 앱 안 1:1 문의(2026-10-20) — 메일 주소는 문의 목록 화면에 같이 */}
          <ListRow icon={LifeBuoy} title={t('profile.help')} onPress={() => router.push('/support')} />
          <ListRow icon={FileText} title={t('profile.terms')} onPress={() => router.push('/terms')} />
          <ListRow icon={ShieldCheck} title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
          {/* 내 정보 받기(2026-10-20, PDPA 열람·이동권) */}
          <ListRow
            icon={Download}
            title={t('profile.exportData')}
            subtitle={t('profile.exportDataHint')}
            showChevron={false}
            onPress={() => {
              setNotice(null);
              exportMyData().catch(() => setNotice(t('profile.exportDataFailed')));
            }}
          />
        </Section>

        <Section>
          <ListRow icon={LogOut} title={t('profile.logout')} onPress={() => void logout()} showChevron={false} />
          <LogoutAllRow />
        </Section>

        {notice ? (
          <ThemedText type="small" themeColor="danger" style={styles.center}>
            {notice}
          </ThemedText>
        ) : null}
        <Button title={t('deleteAccount.title')} variant="ghost" size="md" onPress={startDelete} loading={deleteAccount.isPending} style={styles.delete} />
        {businessInfo ? (
          <View style={styles.business}>
            <ThemedText type="captionBold" themeColor="textTertiary">
              {t('business.title')}
            </ThemedText>
            {BUSINESS_FIELDS.filter((field) => businessInfo[field]).map((field) => (
              <ThemedText key={field} type="caption" themeColor="textTertiary">
                {`${t(`business.${field}`)}: ${businessInfo[field]}`}
              </ThemedText>
            ))}
          </View>
        ) : null}
        <AppVersion />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {label ? (
        <ThemedText type="captionBold" themeColor="textTertiary" style={styles.sectionLabel}>
          {label.toUpperCase()}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: Spacing.five, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  meBody: { flex: 1, gap: 2 },
  meLinks: { flexDirection: 'row', gap: Spacing.three, marginTop: 2 },
  section: { marginTop: Spacing.four },
  sectionLabel: { paddingHorizontal: Spacing.four, marginBottom: Spacing.one, letterSpacing: 0.6 },
  center: { textAlign: 'center', marginTop: Spacing.three },
  delete: { alignSelf: 'center', marginTop: Spacing.three },
  business: { gap: 2, marginTop: Spacing.four, paddingHorizontal: Spacing.two },
});
