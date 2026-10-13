import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from '@/lib/theme-preference';

/** 화면 모드 — 마이페이지에서 직접 고른 값이 있으면 그 값, 아니면 기기 설정(2026-10-12) */
export function useColorScheme() {
  const preference = useThemePreference();
  const system = useSystemColorScheme();
  return preference === 'system' ? system : preference;
}
