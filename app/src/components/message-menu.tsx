import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { X, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export interface MessageAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  danger?: boolean;
  /** 강조색(답장하기 등) */
  accent?: boolean;
}

/**
 * 말풍선을 길게 누르면 그 아래 펼쳐지는 메뉴(2026-10-14 — 팬·아티스트·소속사 공통, 카톡처럼): 복사 · 회수(내 메시지) · 신고·차단(남의 메시지).
 * 예전엔 아티스트·소속사 화면에 휴지통 아이콘이 말풍선 밑에 따로 있어서 "답장 삭제"처럼 보였음
 */
export function MessageMenu({ actions, onClose }: { actions: MessageAction[]; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.menu, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {actions.map((action) => {
        const color = action.danger ? theme.danger : action.accent ? theme.tint : theme.text;
        return (
          <Pressable key={action.key} onPress={action.onPress} style={styles.item} accessibilityRole="button" hitSlop={4}>
            <Icon as={action.icon} size={16} color={color} />
            <ThemedText type="smallBold" style={{ color }}>
              {action.label}
            </ThemedText>
          </Pressable>
        );
      })}
      <IconButton icon={X} size={16} label={t('chat.closeMenu')} onPress={onClose} style={styles.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingLeft: Spacing.three,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.two, paddingRight: Spacing.three },
  close: { width: 36, height: 36 },
});
