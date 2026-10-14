import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';

/**
 * 말풍선 옆 아래에 붙는 작은 시간 — 아티스트·소속사가 보는 팬 답장 목록용. 2026-10-14부터 날짜는 구분선(DayDivider)으로 빼고
 * 시간만(예전엔 "10월 9일 / 오전 4:22" 두 줄)
 */
export function SideTime({ at }: { at: string }) {
  const { i18n } = useTranslation();
  return (
    <View style={styles.wrap}>
      <ThemedText type="caption" themeColor="textTertiary">
        {new Date(at).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 0, paddingBottom: 2 },
});
