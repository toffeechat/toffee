import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/**
 * "1년+" 배지(2026-10-29 장기 구독 혜택) — 1년 이상 이어서 구독한 팬. 아티스트·소속사 답장 화면의 팬 이름 옆, 팬 본인 구독 관리.
 * 라벤더 연한 바탕 + 진한 라벤더 글자(브랜드 색만)
 */
export function YearBadge() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: theme.tintSoft }]} accessibilityLabel={t('streak.yearBadgeLabel')}>
      <ThemedText type="captionBold" style={{ color: theme.chart1 }}>
        {t('streak.yearBadge')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, alignSelf: 'center' },
});
