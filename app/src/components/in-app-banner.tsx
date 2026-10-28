import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BannerPayload {
  title?: string;
  body?: string;
  actorId?: string;
  /** 보낸 사람 사진(2026-10-14, 카톡처럼) — 주면 T 아이콘 대신 프로필 사진(null이면 사람 모양 기본 이미지) */
  avatar?: string | null;
  onPress: () => void;
}

// 앱 어디서든 띄울 수 있게 모듈 수준 구독(푸시 훅 → 배너 컴포넌트)
let listener: ((payload: BannerPayload) => void) | null = null;
export function showInAppBanner(payload: BannerPayload): void {
  listener?.(payload);
}

const VISIBLE_MS = 4000;

/**
 * 앱을 보고 있을 때 온 알림 — 예전엔 목록만 조용히 새로고침해서 다른 화면에 있으면 새 메시지가 온 줄 몰랐음(2026-09-28 점검).
 * 브랜드 보드 07 DM Notification처럼 T 아이콘 + 제목 + 미리보기. 누르면 그 대화로, 4초 뒤 사라짐.
 * 지금 보고 있는 채팅방에서 온 알림이면 띄우지 않음(이미 화면에 보이므로).
 */
export function InAppBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [payload, setPayload] = useState<BannerPayload | null>(null);
  const [offset] = useState(() => new Animated.Value(-160));
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    listener = (next) => {
      if (next.actorId && pathRef.current.includes(next.actorId)) return;
      setPayload(next);
      // 앱을 보고 있을 땐 시스템 알림(소리·진동)이 안 나서 짧게 진동(2026-10-13, 카톡처럼). 보고 있는 채팅방이면 위에서 이미 빠짐
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const native = Platform.OS !== 'web';
    Animated.spring(offset, { toValue: 0, useNativeDriver: native, bounciness: 4 }).start();
    const timer = setTimeout(() => {
      Animated.timing(offset, { toValue: -160, duration: 220, useNativeDriver: native }).start(({ finished }) => {
        // 사라지는 중에 새 알림이 오면 위 spring이 이 애니메이션을 멈춤(finished=false) — 그땐 새 알림을 지우지 않음(2026-10-28)
        if (finished) setPayload(null);
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [payload, offset]);

  if (!payload) return null;
  return (
    <Animated.View style={[styles.wrap, { top: insets.top + Spacing.two, transform: [{ translateY: offset }] }]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          setPayload(null);
          payload.onPress();
        }}
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
        {payload.avatar !== undefined ? (
          <Avatar uri={payload.avatar} size={36} />
        ) : (
          <Image source={require('@/../assets/brand/app-icon-small.png')} style={styles.icon} contentFit="contain" />
        )}
        <View style={styles.body}>
          {payload.title ? (
            <ThemedText type="smallBold" numberOfLines={1}>
              {payload.title}
            </ThemedText>
          ) : null}
          {payload.body ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {payload.body}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F1115',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  icon: { width: 36, height: 36, borderRadius: 9 },
  body: { flex: 1, gap: 2 },
});
