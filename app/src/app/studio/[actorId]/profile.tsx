import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { ChatPhotoEditor } from '@/components/chat-photo-editor';
import { SupportLink } from '@/components/support-link';
import { useActor, type Actor } from '@/hooks/use-actors';
import { useTheme } from '@/hooks/use-theme';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';

/**
 * 배우 본인의 "내 프로필" — 채팅방에 보이는 닉네임·사진은 배우가 직접, 공식 사진·공식 이름은 운영자가 관리
 * (2026-09-28 사용자 결정). 채널이 하나뿐인 배우는 스튜디오 목록을 건너뛰고 바로 채팅방으로 가기 때문에
 * 로그아웃도 여기에 둠.
 */
function NicknameForm({ actor }: { actor: Actor }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState(actor.chatDisplayName);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const save = useMutation({
    mutationFn: (value: string) => apiClient.patch<Actor>(`/actors/${actor.id}/nickname`, { nickname: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['actors'] });
      void queryClient.invalidateQueries({ queryKey: ['my-actors'] });
      setMessage({ text: t('studioProfile.saved'), error: false });
    },
    onError: (e) => setMessage({ text: e instanceof ApiError ? e.message : t('studioProfile.saveFailed'), error: true }),
  });
  const unchanged = nickname.trim() === actor.chatDisplayName;

  return (
    <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{t('studioProfile.nickname')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('studioProfile.nicknameHint')}
      </ThemedText>
      <TextInput
        value={nickname}
        onChangeText={(value) => (setNickname(value), setMessage(null))}
        maxLength={20}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
      />
      {message && (
        <ThemedText type="small" themeColor={message.error ? 'danger' : 'textSecondary'}>
          {message.text}
        </ThemedText>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={unchanged || !nickname.trim() || save.isPending}
        onPress={() => save.mutate(nickname.trim())}
        style={[styles.button, { backgroundColor: theme.tint }, (unchanged || !nickname.trim() || save.isPending) && styles.disabled]}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {t('studioProfile.save')}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

type Greetings = { welcomeMessage: string | null; birthdayMessage: string | null };

/**
 * 환영 메시지·생일 축하 메시지(2026-10-12) — 한 번 써 두면 새로 구독한 팬 대화방 맨 처음, 생일 알림을 켠 팬의 생일 아침에
 * 자동으로 보임. {{name}}은 팬 닉네임으로 바뀜. 비우면 안 보냄. 팬의 생일 날짜는 아티스트에게 보이지 않음.
 */
function GreetingsForm({ actorId }: { actorId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['greetings', actorId], queryFn: () => apiClient.get<Greetings>(`/actors/${actorId}/messages/greetings`) });
  const [draft, setDraft] = useState<{ welcomeMessage: string; birthdayMessage: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const value = draft ?? { welcomeMessage: data?.welcomeMessage ?? '', birthdayMessage: data?.birthdayMessage ?? '' };
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
      <TextInput value={value.birthdayMessage} onChangeText={edit('birthdayMessage')} multiline maxLength={1000} placeholder={t('greetings.placeholder')} placeholderTextColor={theme.textSecondary} style={inputStyle} />
      {message && (
        <ThemedText type="small" themeColor={message.error ? 'danger' : 'textSecondary'}>
          {message.text}
        </ThemedText>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={!draft || save.isPending}
        onPress={() => save.mutate(value)}
        style={[styles.button, { backgroundColor: theme.tint }, (!draft || save.isPending) && styles.disabled]}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {t('studioProfile.save')}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function StudioProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const router = useRouter();
  const { actorId } = useLocalSearchParams<{ actorId: string }>();
  const { data: actor } = useActor(actorId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {actor && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={[styles.section, styles.photoSection, { backgroundColor: theme.backgroundElement }]}>
            {/* 사진이 없으면 사람 모양 기본 이미지(예전엔 빈 남색 동그라미만 보였음, 2026-10-12 실기기 테스트) */}
            <Avatar uri={actor.chatProfileImageUrl} size={96} />
            <ChatPhotoEditor actorId={actor.id} hasPhoto={!!actor.chatProfileImageUrl} />
          </ThemedView>
          <NicknameForm key={actor.id} actor={actor} />
          {/* 커플방이면 방 하나에 한 벌 — 두 멤버 누구나 고칠 수 있음 */}
          <GreetingsForm key={`greetings-${actor.id}`} actorId={actor.id} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('studioProfile.officialNote', { name: actor.legalName })}
          </ThemedText>
          <SupportLink />
          {/* 알림·화면 모드·언어·로그인 정보(2026-10-12 역할별 설정) */}
          <Pressable onPress={() => router.push('/settings/staff')} style={[styles.logout, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{t('staffSettings.title')}</ThemedText>
          </Pressable>
          <Pressable onPress={logout} style={[styles.logout, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="danger">
              {t('common.logout')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  section: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  photoSection: { alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: Spacing.two + 2, alignItems: 'center' },
  buttonText: { color: '#fff' },
  disabled: { opacity: 0.5 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  spaced: { marginTop: Spacing.two },
  logout: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});
