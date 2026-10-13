import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from '@/lib/theme-preference';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Hydration guard for static web rendering, not app state sync — safe to flip once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  // 마이페이지에서 직접 고른 화면 모드가 있으면 그 값(2026-10-12)
  const preference = useThemePreference();

  if (hasHydrated) {
    return preference === 'system' ? colorScheme : preference;
  }

  return 'light';
}
