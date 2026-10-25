import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { fontFor, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_LENGTH = 300;

/**
 * 사유를 적어야 진행되는 확인창(2026-10-25 — 운영자·소속사가 아티스트 메시지를 회수할 때). confirm()과 달리 글 칸이 있어 웹·앱 모두 모달로 그림.
 * 사유가 비어 있으면 확인 버튼이 안 눌림. 확인하면 다듬은 사유로 onConfirm
 */
export function ReasonDialog({
  title,
  message,
  label,
  placeholder,
  okLabel,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  label: string;
  placeholder?: string;
  okLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const ready = !!trimmed && !busy;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {message}
            </ThemedText>
            <ThemedText type="smallMedium" themeColor="textSecondary">
              {label}
            </ThemedText>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={placeholder}
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={MAX_LENGTH}
              autoFocus
              accessibilityLabel={label}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, fontFor(400, i18n.language)]}
            />
            {error ? (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={onClose} accessibilityRole="button" style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText type="smallBold">{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => ready && onConfirm(trimmed)}
                disabled={!ready}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready, busy: !!busy }}
                style={[styles.action, { backgroundColor: theme.danger, opacity: ready ? 1 : 0.4 }]}>
                <ThemedText type="smallBold" style={styles.okText}>
                  {okLabel}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,21,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  sheet: { width: '100%', maxWidth: 400, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  input: { minHeight: 88, maxHeight: 160, borderRadius: Radius.md, padding: Spacing.three, fontSize: 16, textAlignVertical: 'top', outlineStyle: 'none' } as object,
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  action: { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  okText: { color: '#ffffff' },
});
