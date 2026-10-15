import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AtSign } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { apiClient, ApiError } from '@/lib/api-client';
import { Radius, Spacing } from '@/constants/theme';
import { NAME_TOKEN } from '@/utils/name-token';

export type Greetings = { welcomeMessage: string | null; birthdayMessage: string | null };

export function useGreetings(actorId: string | undefined) {
  return useQuery({
    queryKey: ['greetings', actorId],
    queryFn: () => apiClient.get<Greetings>(`/actors/${actorId}/messages/greetings`),
    enabled: !!actorId,
  });
}

/** 써 뒀는지 — 2026-10-13부터 필수(비어 있으면 스튜디오가 이 양식부터 보여 주고, 서버도 보내기를 거절). CP방은 환영 메시지만(2026-10-14) */
export const greetingsReady = (g: Greetings | undefined, couple = false) =>
  !!g?.welcomeMessage?.trim() && (couple || !!g?.birthdayMessage?.trim());

/**
 * 환영 메시지·생일 축하 메시지(2026-10-12) — 한 번 써 두면 새로 구독한 팬 대화방 맨 처음, 생일 알림을 켠 팬의 생일 아침에
 * 자동으로 보임. {{name}}은 팬 닉네임으로 바뀜. 팬의 생일 날짜는 아티스트에게 보이지 않음.
 * 2026-10-13 사용자 결정으로 둘 다 필수 — 빈 칸으로는 저장 못 함(스튜디오 첫 화면에서 먼저 쓰게 함).
 */
// couple: CP방 — 생일 칸 없이 환영 메시지만(2026-10-14 사용자 결정, 생일 축하는 개인방에서만 가서 두 번 받지 않게)
export function GreetingsForm({ actorId, couple = false }: { actorId: string; couple?: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useGreetings(actorId);
  const [draft, setDraft] = useState<{ welcomeMessage: string; birthdayMessage: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const value = draft ?? { welcomeMessage: data?.welcomeMessage ?? '', birthdayMessage: data?.birthdayMessage ?? '' };
  const complete = !!value.welcomeMessage.trim() && (couple || !!value.birthdayMessage.trim());
  const save = useMutation({
    mutationFn: (input: { welcomeMessage: string; birthdayMessage?: string }) => apiClient.put<Greetings>(`/actors/${actorId}/messages/greetings`, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(['greetings', actorId], saved);
      setDraft(null);
      setMessage({ text: t('studioProfile.saved'), error: false });
    },
    onError: (e) => setMessage({ text: e instanceof ApiError ? e.message : t('studioProfile.saveFailed'), error: true }),
  });
  const edit = (key: keyof typeof value) => (text: string) => (setDraft({ ...value, [key]: text }), setMessage(null));
  // "팬 이름 넣기"(2026-10-15 사용자 요청 — {{name}}을 직접 치지 않게): 커서 자리에, 커서를 모르면 끝에 넣음
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const insertName = (key: keyof typeof value) => {
    const text = value[key];
    const at = Math.min(cursor[key] ?? text.length, text.length);
    edit(key)(text.slice(0, at) + NAME_TOKEN + text.slice(at));
    setCursor((c) => ({ ...c, [key]: at + NAME_TOKEN.length }));
  };
  const nameButton = (key: keyof typeof value) => (
    <View style={styles.nameRow}>
      <Pressable onPress={() => insertName(key)} accessibilityRole="button" accessibilityHint={t('studio.insertNameHint')} style={[styles.nameChip, { backgroundColor: theme.background }]}>
        <Icon as={AtSign} size={15} color={theme.tint} />
        <ThemedText type="smallMedium">{t('studio.insertName')}</ThemedText>
      </Pressable>
    </View>
  );
  const inputStyle = [styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }];
  const disabled = !draft || !complete || save.isPending;

  return (
    <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{t('greetings.welcomeTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('greetings.welcomeHint')}
      </ThemedText>
      <TextInput
        value={value.welcomeMessage}
        onChangeText={edit('welcomeMessage')}
        onSelectionChange={(e) => setCursor((c) => ({ ...c, welcomeMessage: e.nativeEvent.selection.end }))}
        multiline maxLength={1000} placeholder={t('greetings.placeholder')} placeholderTextColor={theme.textSecondary} style={inputStyle} />
      {nameButton('welcomeMessage')}
      {couple ? null : (
        <>
          <ThemedText type="smallBold" style={styles.spaced}>
            {t('greetings.birthdayTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('greetings.birthdayHint')}
          </ThemedText>
          <TextInput
            value={value.birthdayMessage}
            onChangeText={edit('birthdayMessage')}
            onSelectionChange={(e) => setCursor((c) => ({ ...c, birthdayMessage: e.nativeEvent.selection.end }))}
            multiline maxLength={1000} placeholder={t('greetings.birthdayPlaceholder')} placeholderTextColor={theme.textSecondary} style={inputStyle} />
          {nameButton('birthdayMessage')}
        </>
      )}
      {message ? (
        <ThemedText type="small" themeColor={message.error ? 'danger' : 'textSecondary'}>
          {message.text}
        </ThemedText>
      ) : draft && !complete ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t(couple ? 'greetings.welcomeRequired' : 'greetings.bothRequired')}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => save.mutate({ welcomeMessage: value.welcomeMessage.trim(), ...(couple ? {} : { birthdayMessage: value.birthdayMessage.trim() }) })}
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
  nameRow: { flexDirection: 'row' },
  nameChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: Spacing.three - 4, borderRadius: Radius.pill },
});
