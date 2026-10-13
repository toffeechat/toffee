import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { apiClient, ApiError } from '@/lib/api-client';
import { Spacing } from '@/constants/theme';

export type Greetings = { welcomeMessage: string | null; birthdayMessage: string | null };

export function useGreetings(actorId: string | undefined) {
  return useQuery({
    queryKey: ['greetings', actorId],
    queryFn: () => apiClient.get<Greetings>(`/actors/${actorId}/messages/greetings`),
    enabled: !!actorId,
  });
}

/** 둘 다 써 뒀는지 — 2026-10-13부터 필수(비어 있으면 스튜디오가 이 양식부터 보여 주고, 서버도 보내기를 거절) */
export const greetingsReady = (g: Greetings | undefined) => !!g?.welcomeMessage?.trim() && !!g?.birthdayMessage?.trim();

/**
 * 환영 메시지·생일 축하 메시지(2026-10-12) — 한 번 써 두면 새로 구독한 팬 대화방 맨 처음, 생일 알림을 켠 팬의 생일 아침에
 * 자동으로 보임. {{name}}은 팬 닉네임으로 바뀜. 팬의 생일 날짜는 아티스트에게 보이지 않음.
 * 2026-10-13 사용자 결정으로 둘 다 필수 — 빈 칸으로는 저장 못 함(스튜디오 첫 화면에서 먼저 쓰게 함).
 */
export function GreetingsForm({ actorId }: { actorId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useGreetings(actorId);
  const [draft, setDraft] = useState<{ welcomeMessage: string; birthdayMessage: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const value = draft ?? { welcomeMessage: data?.welcomeMessage ?? '', birthdayMessage: data?.birthdayMessage ?? '' };
  const complete = !!value.welcomeMessage.trim() && !!value.birthdayMessage.trim();
  const save = useMutation({
    mutationFn: (input: typeof value) => apiClient.put<Greetings>(`/actors/${actorId}/messages/greetings`, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(['greetings', actorId], saved);
      setDraft(null);
      setMessage({ text: t('studioProfile.saved'), error: false });
    },
    onError: (e) => setMessage({ text: e instanceof ApiError ? e.message : t('studioProfile.saveFailed'), error: true }),
  });
  const edit = (key: keyof typeof value) => (text: string) => (setDraft({ ...value, [key]: text }), setMessage(null));
  const inputStyle = [styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }];
  const disabled = !draft || !complete || save.isPending;

  return (
    <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{t('greetings.welcomeTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('greetings.welcomeHint')}
      </ThemedText>
      <TextInput value={value.welcomeMessage} onChangeText={edit('welcomeMessage')} multiline maxLength={1000} placeholder={t('greetings.placeholder')} placeholderTextColor={theme.textSecondary} style={inputStyle} />
      <ThemedText type="smallBold" style={styles.spaced}>
        {t('greetings.birthdayTitle')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('greetings.birthdayHint')}
      </ThemedText>
      <TextInput value={value.birthdayMessage} onChangeText={edit('birthdayMessage')} multiline maxLength={1000} placeholder={t('greetings.birthdayPlaceholder')} placeholderTextColor={theme.textSecondary} style={inputStyle} />
      {message ? (
        <ThemedText type="small" themeColor={message.error ? 'danger' : 'textSecondary'}>
          {message.text}
        </ThemedText>
      ) : draft && !complete ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('greetings.bothRequired')}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => save.mutate({ welcomeMessage: value.welcomeMessage.trim(), birthdayMessage: value.birthdayMessage.trim() })}
        style={[styles.button, { backgroundColor: theme.tint }, disabled && styles.disabled]}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {t('studioProfile.save')}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: Spacing.two + 2, alignItems: 'center' },
  buttonText: { color: '#fff' },
  disabled: { opacity: 0.5 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  spaced: { marginTop: Spacing.two },
});
