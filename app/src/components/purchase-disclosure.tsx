import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * 구독 결제 버튼 아래 고지(2026-10-12, 버블 비교 점검) — 애플 가이드라인 3.1.2·개발자 계약 Schedule 2(자동 갱신 구독은
 * 구매 화면에 기간·가격·이용약관·개인정보처리방침 링크), 구글 Play 구독 정책(해지 방법), 전자상거래법 제13조·제17조
 * (거래 조건·청약철회 고지). 해지는 토피 앱이 아니라 스토어 구독 관리에서만 됨 — 예전 "계정 설정에서 해지" 문구는 틀렸음.
 */
export function PurchaseDisclosure({ bundle = false }: { bundle?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const store = Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : t('subscribeFlow.storeAny');
  const lines = [
    t('subscribeFlow.autoRenew', { store }),
    t('subscribeFlow.refundNote'),
    t('subscribeFlow.messageNote'),
    ...(bundle ? [t('subscribeFlow.bundleNote')] : []),
  ];
  return (
    <View style={styles.wrap}>
      {lines.map((line) => (
        <ThemedText key={line} type="caption" themeColor="textTertiary">
          {`• ${line}`}
        </ThemedText>
      ))}
      <View style={styles.links}>
        <Pressable onPress={() => router.push('/terms')} hitSlop={8} accessibilityRole="link">
          <ThemedText type="captionBold" themeColor="textSecondary" style={styles.link}>
            {t('profile.terms')}
          </ThemedText>
        </Pressable>
        <ThemedText type="caption" themeColor="textTertiary">
          ·
        </ThemedText>
        <Pressable onPress={() => router.push('/privacy')} hitSlop={8} accessibilityRole="link">
          <ThemedText type="captionBold" themeColor="textSecondary" style={styles.link}>
            {t('profile.privacy')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one, marginTop: Spacing.one },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.one },
  link: { textDecorationLine: 'underline' },
});
