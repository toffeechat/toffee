import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Eye } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth-context';
import { SHOW_DEV_LOGIN } from '@/lib/demo-entry';
import { useDemoSwitch, useDemoViewAs } from '@/lib/demo-switch';
import { Spacing } from '@/constants/theme';

/**
 * 소속사에서 팬·아티스트 화면으로 바꿔 보는 동안(데모) 화면 맨 위에 "○○ 화면으로 보는 중 · 소속사로 돌아가기" 띠(2026-11-24).
 * 띠가 상태 표시줄 자리를 차지하므로 아래 화면들에는 위쪽 여백 0을 넘김(화면마다 고치지 않고 띠 하나로).
 */
export function DemoViewFrame({ children }: { children: ReactNode }) {
  const viewAs = useDemoViewAs();
  const { role } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { switchTo, busy, failed } = useDemoSwitch();
  const show = SHOW_DEV_LOGIN && !!viewAs && (role === 'USER' || role === 'ACTOR');
  if (!show) return <>{children}</>;
  return (
    <View style={styles.flex}>
      <Pressable
        onPress={() => void switchTo('agency')}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityLabel={`${t(viewAs === 'fan' ? 'demoView.bannerFan' : 'demoView.bannerArtist')} ${t('demoView.back')}`}
        style={[styles.banner, { paddingTop: insets.top + Spacing.two }]}>
        <Icon as={Eye} size={16} color="#DCE1FF" />
        <ThemedText type="smallMedium" style={styles.label} numberOfLines={1}>
          {failed ? t('demoView.failed') : t(viewAs === 'fan' ? 'demoView.bannerFan' : 'demoView.bannerArtist')}
        </ThemedText>
        {busy ? (
          <ActivityIndicator color="#DCE1FF" size="small" />
        ) : (
          <View style={styles.back}>
            <Icon as={ChevronLeft} size={16} color="#DCE1FF" />
            <ThemedText type="smallBold" style={styles.backText} numberOfLines={1}>
              {t('demoView.back')}
            </ThemedText>
          </View>
        )}
      </Pressable>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // 브랜드 Charcoal 띠 + Periwinkle 글자 — 화면 테마와 상관없이 늘 같은 색(앱 화면과 구분되게)
  banner: { backgroundColor: '#0F1115', flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  label: { flex: 1, color: '#FFFFFF' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: '#DCE1FF' },
});
