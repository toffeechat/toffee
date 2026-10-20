import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { setFullMessage, type FullMessage } from '@/lib/full-message';
import { useTheme } from '@/hooks/use-theme';
import { clipLongMessage } from '@/utils/long-message';
import { Spacing } from '@/constants/theme';

/**
 * 말풍선 글(2026-10-19 긴 메시지 전체보기) — 500자·15줄을 넘으면 앞부분만 + "전체보기", 누르면 전체 화면(app/message.tsx).
 * 번역이 붙는 글은 TranslatableText가 이걸 씀. full이면(전체 화면 안) 자르지 않고 길게 눌러 고를 수 있게.
 */
export function MessageText({ message, display, full }: { message: FullMessage; display?: string; full?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const shown = display ?? message.text;
  if (full) return <ThemedText selectable>{shown}</ThemedText>;
  const clip = clipLongMessage(shown);
  if (!clip.clipped) return <ThemedText>{shown}</ThemedText>;
  return (
    <>
      <ThemedText>{clip.text}</ThemedText>
      <Pressable
        onPress={() => {
          setFullMessage(message);
          router.push('/message');
        }}
        hitSlop={6}
        accessibilityRole="button"
        style={styles.seeAll}>
        <ThemedText type="smallMedium" style={{ color: theme.tint }}>
          {t('longMessage.seeAll')} ›
        </ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  seeAll: { marginTop: Spacing.one, alignSelf: 'flex-start' },
});
