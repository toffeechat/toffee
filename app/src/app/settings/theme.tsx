import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { useTheme } from '@/hooks/use-theme';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme-preference';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 화면 모드(2026-10-12 사용자 요청) — 기기 설정 따르기(기본) / 라이트 / 다크. 이 기기에만 저장 */
export default function ThemeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const preference = useThemePreference();
  const options: ThemePreference[] = ['system', 'light', 'dark'];
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      {options.map((option) => (
        <ListRow
          key={option}
          title={t(`themeMode.${option}`)}
          onPress={() => setThemePreference(option)}
          showChevron={false}
          trailing={preference === option ? <Icon as={Check} size={20} color={theme.tint} /> : undefined}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
