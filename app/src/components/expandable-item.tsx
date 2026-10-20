import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/** FAQ·공지사항 — 제목을 누르면 본문이 펼쳐지는 한 줄. footer는 펼쳤을 때 본문 아래(공지 [번역 보기], 2026-10-20) */
export function ExpandableItem({ title, caption, body, footer }: { title: string; caption?: string; body: string; footer?: ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.headText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {caption ? (
            <ThemedText type="caption" themeColor="textTertiary">
              {caption}
            </ThemedText>
          ) : null}
        </View>
        <Icon as={open ? ChevronUp : ChevronDown} size={18} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {body}
          </ThemedText>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderRadius: Radius.lg, paddingHorizontal: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  headText: { flex: 1, gap: 2 },
  body: { paddingBottom: Spacing.three, gap: Spacing.two },
});
