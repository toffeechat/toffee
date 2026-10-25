import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleAlert, RotateCw } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 보내기 실패 + "다시 보내기"(2026-10-25) — 연결이 끊겨서(서버 오류 포함) 자동 재시도까지 실패했을 때 입력칸 위에 남음(몇 초 뒤 사라지는
 * 알림 대신). 보내려던 글·첨부는 입력칸에 그대로 있고, 다시 보내도 중복 방지 키가 같아서 이미 저장됐으면 한 번만 감.
 */
export function SendRetryBar({ onRetry, onDismiss, busy }: { onRetry: () => void; onDismiss?: () => void; busy?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderColor: theme.danger, backgroundColor: theme.backgroundElement }]} accessibilityRole="alert">
      <Icon as={CircleAlert} size={16} color={theme.danger} />
      <ThemedText type="small" style={styles.text}>
        {t('sendRetry.failed')}
      </ThemedText>
      {onDismiss ? <Button title={t('sendRetry.dismiss')} variant="ghost" size="md" onPress={onDismiss} disabled={busy} /> : null}
      <Button title={t('sendRetry.action')} icon={RotateCw} variant="secondary" size="md" onPress={onRetry} loading={busy} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.two,
  },
  text: { flex: 1 },
});
