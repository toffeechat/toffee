import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';

/**
 * 말풍선 옆 아래에 붙는 작은 날짜·시간(2026-10-13) — 아티스트·소속사가 보는 팬 답장 목록용.
 * 한 줄("10월 9일 오전 4:22")로 쓰면 길어서 말풍선 아래로 밀려나서, 날짜와 시간을 두 줄로 쌓아 폭을 줄임
 * (아티스트 메시지 화면의 시간 표시와 같은 모양).
 */
export function SideTime({ at }: { at: string }) {
  const { i18n } = useTranslation();
  const time = new Date(at);
  return (
    <View style={styles.wrap}>
      <ThemedText type="caption" themeColor="textTertiary">
        {time.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
      </ThemedText>
      <ThemedText type="caption" themeColor="textTertiary">
        {time.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 0, paddingBottom: 2 },
});
