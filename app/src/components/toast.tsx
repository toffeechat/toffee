import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

// 앱 어디서든 "복사했어요" 같은 짧은 안내(2026-10-14) — 루트 레이아웃의 <ToastHost />가 그림
let listener: ((text: string) => void) | null = null;
export function showToast(text: string): void {
  listener?.(text);
}

const VISIBLE_MS = 2000;

export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    listener = setText;
    return () => {
      listener = null;
    };
  }, []);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <View style={[styles.toast, { backgroundColor: theme.text }]}>
        <ThemedText type="small" style={{ color: theme.background }}>
          {text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  toast: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, maxWidth: '86%' },
});
