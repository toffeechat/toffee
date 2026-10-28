import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { membersOf, useActor } from '@/hooks/use-actors';
import { useScreenshotWarning } from '@/hooks/use-screenshot-warning';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * 대화방 프로필 카드(2026-10-02, 카톡 프로필처럼) — 채팅방 헤더 이름이나 메시지 옆 프로필 사진을 누르면 열림.
 * 정보만 보여줌: 대화방 사진(누르면 크게), 닉네임(크게) + 공식 이름(작게, 다를 때만), 상태메시지(2026-10-25, 비어 있으면 줄 자체를 숨김),
 * 커플방이면 멤버(멤버별 상태메시지).
 * 신고·인증 배지·모아보기·구독 관리는 넣지 않음(신고는 메시지 길게 누르기, 나머지는 채팅방 ⋯ 메뉴).
 * memberId가 있으면 커플방 멤버 배우 한 명의 카드(커플방에서 메시지 옆 사진을 눌렀을 때).
 * 배경(2026-10-28 사용자 결정, 카톡 프로필처럼): 아티스트·소속사가 정한 프로필 배경 사진이 있으면 화면 전체 뒤에 깔고 어둡게 덮어 글자를 흰색으로,
 * 없으면 지금 모양(기본 배경). 토피룸 배경과는 따로. 커플방은 방의 배경(멤버 카드도 같은 방 배경).
 * 구독 전 둘러보기는 공식 프로필(actor/[id], 공식 이름·공식 사진만)이고, 이 카드는 구독자만 들어오는 채팅방에서만 열림.
 */
export default function ChatProfileScreen() {
  const theme = useTheme();
  // 프로필에서 캡처해도 경고(2026-10-28, 버블처럼) — 아티스트 사진·정보 무단 사용 안내
  useScreenshotWarning(true, 'profile');
  const { t } = useTranslation();
  const router = useRouter();
  const { actorId, memberId } = useLocalSearchParams<{ actorId: string; memberId?: string }>();
  const { data: actor } = useActor(actorId);
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/chat/[actorId]', params: { actorId } }));

  const members = actor ? membersOf(actor) : [];
  const member = memberId ? members.find((m) => m.id === memberId) : undefined;
  const profile = member
    ? { name: member.chatDisplayName, official: member.legalName, photo: member.chatProfileImageUrl ?? actor?.chatProfileImageUrl ?? null, status: member.statusMessage ?? null }
    : actor
      ? { name: actor.chatDisplayName, official: actor.legalName, photo: actor.chatProfileImageUrl, status: actor.statusMessage ?? null }
      : null;

  const openPhoto = () => {
    if (!profile?.photo) return;
    router.push({ pathname: '/media-viewer', params: { id: `profile-${memberId ?? actorId}`, url: profile.photo, type: 'PHOTO' } });
  };

  const bg = actor?.profileBackgroundUrl ?? null;
  // 배경 사진 위에선 글자를 흰색으로(어둡게 덮은 위라 라이트·다크 모드 모두 같게)
  const onBg = bg ? { color: '#ffffff' } : undefined;
  const onBgSub = bg ? { color: 'rgba(255,255,255,0.8)' } : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg ? '#000000' : theme.background }]}>
      {bg ? (
        <>
          <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      ) : null}
      <View style={styles.top}>
        <IconButton icon={X} label={t('chatProfile.close')} onPress={close} color={bg ? '#ffffff' : undefined} />
      </View>
      {profile ? (
        // 배경이 있으면 카톡처럼 사진·이름을 아래쪽에(배경이 보이게)
        <ScrollView contentContainerStyle={[styles.body, bg ? styles.bodyOnBg : null]}>
          <Pressable onPress={openPhoto} disabled={!profile.photo} accessibilityRole="imagebutton" accessibilityLabel={t('chatProfile.viewPhoto')}>
            <Avatar uri={profile.photo} size={128} />
          </Pressable>
          <View style={styles.names}>
            <ThemedText type="title" style={[styles.center, onBg]}>
              {profile.name}
            </ThemedText>
            {profile.official !== profile.name ? (
              <ThemedText type="small" themeColor="textSecondary" style={[styles.center, onBgSub]}>
                {profile.official}
              </ThemedText>
            ) : null}
            {profile.status ? (
              <ThemedText type="default" themeColor="textSecondary" style={[styles.center, styles.status, onBgSub]}>
                {profile.status}
              </ThemedText>
            ) : null}
          </View>

          {!member && members.length > 0 ? (
            // 커플방 카드: 멤버 배우 — 누르면 그 배우 카드
            <View style={[styles.members, { borderTopColor: bg ? 'rgba(255,255,255,0.3)' : theme.border }]}>
              <ThemedText type="captionBold" themeColor="textTertiary" style={onBgSub}>
                {t('chatProfile.members')}
              </ThemedText>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: '/chat-profile/[actorId]', params: { actorId, memberId: m.id } })}
                  style={styles.member}
                  accessibilityRole="button">
                  <Avatar uri={m.chatProfileImageUrl ?? actor?.chatProfileImageUrl} size={44} />
                  <View style={styles.memberNames}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1} style={onBg}>
                      {m.chatDisplayName}
                    </ThemedText>
                    {m.legalName !== m.chatDisplayName ? (
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={onBgSub}>
                        {m.legalName}
                      </ThemedText>
                    ) : null}
                    {m.statusMessage ? (
                      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={onBgSub}>
                        {m.statusMessage}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  bodyOnBg: { flexGrow: 1, justifyContent: 'flex-end' },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  body: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.five, paddingBottom: Spacing.six, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  names: { alignItems: 'center', gap: Spacing.one },
  center: { textAlign: 'center' },
  status: { marginTop: Spacing.two },
  members: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, gap: Spacing.two },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  memberNames: { flex: 1, minWidth: 0 },
});
