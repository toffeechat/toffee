import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/**
 * 맨 아래로 가기(2026-10-15 사용자 요청, 카톡처럼) — 대화를 위로 올려 보는 중이면 오른쪽 아래 작은 동그라미 ↓. 새 메시지가 와서 "새 메시지 미리보기"
 * 카드가 뜨는 동안엔 그 카드가 같은 일을 해서 이 버튼은 숨김(부르는 쪽에서) — 둘이 겹치지 않게
 */
export function ScrollToBottomButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('chat.scrollToBottom')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.background, borderColor: theme.border, opacity: pressed ? 0.8 : 0.95 }]}>
      <Icon as={ChevronDown} size={20} themeColor="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
