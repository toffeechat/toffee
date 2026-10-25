import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { ChatBackgroundPreview, ChatPhotoEditor } from '@/components/chat-photo-editor';
import { GreetingsForm } from '@/components/greetings-form';
import { SupportLink } from '@/components/support-link';
import { membersOf, useActor, type Actor } from '@/hooks/use-actors';
import { useMyActors } from '@/hooks/use-console';
import { useMe } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';
import { apiClient, ApiError } from '@/lib/api-client';
import { Spacing } from '@/constants/theme';

/**
 * 배우 본인의 "토피룸 설정"(2026-10-15 "내 프로필"에서 이름 변경) — 프로필(사진·닉네임·상태메시지)과 토피룸(배경·인사 메시지)
 * 두 묶음. 채팅방에 보이는 닉네임·사진은 배우가 직접, 공식 사진·공식 이름은 운영자가 관리
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

const STATUS_MAX = 60;

/**
 * 상태메시지(2026-10-25 사용자 결정) — 팬이 보는 토피룸 프로필 카드의 한 줄. 처음엔 빈칸(기본 문구 없음), 비워 두면 카드에 줄이 안 보임.
 * 아티스트 본인만 쓰고 지움(운영자는 운영자 화면에서 지우기만). 커플방 설정에선 "내" 멤버 값 — 개인방·CP방 카드에 같이 보임.
 * 60자·금칙어는 서버가 검사.
 */
function StatusMessageForm({ actorId, current, couple }: { actorId: string; current: string | null; couple: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(current ?? '');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const save = useMutation({
    mutationFn: (next: string) => apiClient.patch<Actor>(`/actors/${actorId}/status-message`, { statusMessage: next }),
    onSuccess: (_, next) => {
      void queryClient.invalidateQueries({ queryKey: ['actors'] });
      void queryClient.invalidateQueries({ queryKey: ['my-actors'] });
      if (!next) setValue('');
      setMessage({ text: t(next ? 'studioProfile.saved' : 'studioProfile.statusMessageCleared'), error: false });
    },
    onError: (e) => setMessage({ text: e instanceof ApiError ? e.message : t('studioProfile.saveFailed'), error: true }),
  });
  const trimmed = value.trim();
  const unchanged = trimmed === (current ?? '');

  return (
    <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{t('studioProfile.statusMessage')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(couple ? 'studioProfile.statusMessageCoupleHint' : 'studioProfile.statusMessageHint')}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={(next) => (setValue(next), setMessage(null))}
        maxLength={STATUS_MAX}
        placeholder={t('studioProfile.statusMessagePlaceholder')}
        placeholderTextColor={theme.textTertiary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
      />
      <ThemedText type="caption" themeColor="textTertiary" style={styles.counter}>
        {`${[...value].length}/${STATUS_MAX}`}
      </ThemedText>
      {message && (
        <ThemedText type="small" themeColor={message.error ? 'danger' : 'textSecondary'}>
          {message.text}
        </ThemedText>
      )}
      <View style={styles.row}>
        {current ? (
          <Pressable
            accessibilityRole="button"
            disabled={save.isPending}
            onPress={() => save.mutate('')}
            style={[styles.button, styles.rowButton, { borderColor: theme.backgroundSelected, borderWidth: 1 }, save.isPending && styles.disabled]}>
            <ThemedText type="smallBold" themeColor="danger">
              {t('studioProfile.statusMessageClear')}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={unchanged || save.isPending}
          onPress={() => save.mutate(trimmed)}
          style={[styles.button, styles.rowButton, { backgroundColor: theme.tint }, (unchanged || save.isPending) && styles.disabled]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            {t('studioProfile.save')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function StudioProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { actorId } = useLocalSearchParams<{ actorId: string }>();
  const { data: actor } = useActor(actorId);
  const { data: me } = useMe();
  const { data: myActors } = useMyActors();
  // 상태메시지는 배우 본인 것 — 커플방이면 멤버 중 내 개인방(1인 방)인 쪽. 운영자가 들어와 보면 폼을 숨김(지우기는 운영자 화면에서)
  const couple = actor?.kind === 'COUPLE';
  const mySoloIds = new Set((myActors ?? []).filter((row) => row.kind !== 'COUPLE').map((row) => row.id));
  const myMember = couple && actor ? membersOf(actor).find((m) => mySoloIds.has(m.id)) : undefined;
  const statusTarget = me?.role !== 'ACTOR' || !actor ? null : couple ? (myMember ? { current: myMember.statusMessage ?? null } : null) : { current: actor.statusMessage ?? null };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {actor && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
            {t('studioProfile.sectionProfile')}
          </ThemedText>
          <ThemedView style={[styles.section, styles.photoSection, { backgroundColor: theme.backgroundElement }]}>
            {/* 사진이 없으면 사람 모양 기본 이미지(예전엔 빈 남색 동그라미만 보였음, 2026-10-12 실기기 테스트) */}
            <Avatar uri={actor.chatProfileImageUrl} size={96} />
            <ChatPhotoEditor actorId={actor.id} hasPhoto={!!actor.chatProfileImageUrl} />
          </ThemedView>
          <NicknameForm key={actor.id} actor={actor} />
          {statusTarget ? (
            <StatusMessageForm key={`status-${actor.id}`} actorId={actor.id} current={statusTarget.current} couple={couple} />
          ) : null}
          <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.groupTitle, styles.spaced]}>
            {t('studioProfile.sectionRoom')}
          </ThemedText>
          {/* 토피룸 배경 사진(2026-10-14) — 팬 토피룸 뒤에 깔림 */}
          <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{t('chatBackground.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('chatBackground.hint')}
            </ThemedText>
            <ChatBackgroundPreview uri={actor.chatBackgroundUrl} />
            <ChatPhotoEditor actorId={actor.id} hasPhoto={!!actor.chatBackgroundUrl} target="background" />
          </ThemedView>
          {/* 커플방이면 방 하나에 한 벌 — 두 멤버 누구나 고칠 수 있음 */}
          <GreetingsForm key={`greetings-${actor.id}`} actorId={actor.id} couple={actor.kind === 'COUPLE'} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('studioProfile.officialNote', { name: actor.legalName })}
          </ThemedText>
          <SupportLink />
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
  counter: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', gap: Spacing.two },
  rowButton: { flex: 1 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  spaced: { marginTop: Spacing.two },
  groupTitle: { marginBottom: -Spacing.one, paddingHorizontal: Spacing.one },
});
