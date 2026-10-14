import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';

/**
 * 토피룸 배경 사진(2026-10-14 사용자 결정, 1차) — 아티스트·소속사가 방마다 한 장 정하면 팬·아티스트 토피룸 뒤에 깔림.
 * 시간·날짜 글자가 사진 위에서도 읽히게 화면 색(라이트=흰색, 다크=검정)으로 반쯤 덮음. 없으면 아무것도 안 그림(기본 배경)
 */
export function ChatBackground({ uri }: { uri?: string | null }) {
  const theme = useTheme();
  if (!uri) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background, opacity: 0.45 }]} />
    </View>
  );
}
