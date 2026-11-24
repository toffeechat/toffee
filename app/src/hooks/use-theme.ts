/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // RN 0.88(SDK 58)부터 정해지지 않으면 'unspecified' 대신 null
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
