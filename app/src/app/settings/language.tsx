import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ListRow } from '@/components/ui/list-row';
import { useMe, useUpdateTranslationSettings } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGE_NATIVE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/languages';
import { useLocalePreference } from '@/i18n/locale-preference-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** 언어 — "기기 언어 따르기"(기본) 또는 직접 고정. 언어 이름은 항상 그 언어 자신의 표기로. 아래에 메시지 자동 번역(2026-10-16) */
export default function LanguageScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { override, setOverride } = useLocalePreference();
  const options: { value: SupportedLanguage | null; label: string }[] = [
    { value: null, label: t('profile.languageSystem') },
    ...SUPPORTED_LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NATIVE_NAMES[language] })),
  ];
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      {options.map((option) => (
        <ListRow
          key={option.value ?? 'system'}
          title={option.label}
          onPress={() => setOverride(option.value)}
          showChevron={false}
          trailing={override === option.value ? <Icon as={Check} size={20} color={theme.tint} /> : undefined}
        />
      ))}
      <AutoTranslateToggle />
    </ScrollView>
  );
}

/** 메시지 자동 번역(2026-10-16, 기본 켜짐) — 모든 역할 공통(팬: 아티스트 메시지, 아티스트·소속사: 팬 답장) */
function AutoTranslateToggle() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateTranslationSettings();
  if (!me) return null;
  return (
    <View style={[styles.toggle, { borderTopColor: theme.border }]}>
      <View style={styles.row}>
        <ThemedText type="defaultMedium" style={styles.title}>
          {t('translate.autoTitle')}
        </ThemedText>
        <Switch
          value={update.isPending ? update.variables : me.autoTranslate !== false}
          onValueChange={(on) => update.mutate(on)}
          trackColor={{ true: theme.tint, false: theme.border }}
          thumbColor="#ffffff"
          accessibilityLabel={t('translate.autoTitle')}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('translate.autoHint')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  toggle: { marginTop: Spacing.three, paddingTop: Spacing.three, paddingHorizontal: Spacing.four, gap: Spacing.one, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { flex: 1 },
});
