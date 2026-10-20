import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Mic, Video, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { CountBadge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import type { MyActor } from '@/hooks/use-console';
import { useTheme } from '@/hooks/use-theme';
import { isUpcoming } from '@/utils/release';
import { Spacing } from '@/constants/theme';
import { showNameToken } from '@/utils/name-token';
import { formatInboxTime } from '@/utils/relative-time';

const MEDIA_ICON: Partial<Record<string, LucideIcon>> = { PHOTO: ImageIcon, AUDIO: Mic, VIDEO: Video };
const MEDIA_TEXT: Partial<Record<string, string>> = { PHOTO: 'inbox.sentPhoto', AUDIO: 'inbox.sentVoice', VIDEO: 'inbox.sentVideo' };

/**
 * 토피룸 목록 한 줄(2026-10-14 사용자 요청 "카톡 대화방 목록처럼") — 아티스트 스튜디오·소속사 "소속 아티스트" 공통:
 * 사진 · 이름(CP방이면 CP 표시) · 마지막 메시지 · 시간 · (소속사 웹) 새 메시지 수. extra는 그 아래 한 줄(소속사만 "마지막 메시지 N일 전")
 */
export function RoomListRow({ actor, unread = 0, extra, onPress }: { actor: MyActor; unread?: number; extra?: ReactNode; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const last = actor.lastMessage;
  const mediaIcon = last && !last.body ? MEDIA_ICON[last.mediaType] : undefined;
  const preview = !last
    ? t('rooms.noMessagesYet')
    : last.body
      ? showNameToken(last.body, t('studio.fanNickname'))
      : MEDIA_TEXT[last.mediaType]
        ? t(MEDIA_TEXT[last.mediaType]!)
        : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[actor.chatDisplayName, preview].join(', ')}
      style={({ pressed, hovered }) => [styles.row, { backgroundColor: pressed || hovered ? theme.backgroundElement : 'transparent' }]}>
      <Avatar uri={actor.chatProfileImageUrl} size={56} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.nameLine}>
            <ThemedText type="headline" numberOfLines={1} style={styles.name}>
              {actor.chatDisplayName}
            </ThemedText>
            {actor.kind === 'COUPLE' ? (
              <ThemedText type="captionBold" style={[styles.tag, { color: theme.tint, borderColor: theme.tint }]}>
                {t('couple.roomLabel')}
              </ThemedText>
            ) : null}
            {isUpcoming(actor.releaseAt) ? (
              <ThemedText type="captionBold" style={[styles.tag, { color: theme.tint, borderColor: theme.tint }]}>
                {t('release.comingSoon')}
              </ThemedText>
            ) : null}
          </View>
          {last ? (
            <ThemedText type="caption" style={{ color: unread > 0 ? theme.tint : theme.textTertiary }}>
              {formatInboxTime(last.createdAt, i18n.language, t)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <View style={styles.previewLine}>
            {mediaIcon && <Icon as={mediaIcon} size={15} color={theme.textSecondary} />}
            <ThemedText type="small" numberOfLines={1} style={[styles.preview, { color: theme.textSecondary }]}>
              {preview}
            </ThemedText>
          </View>
          <CountBadge count={unread} />
        </View>
        {extra}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 10 },
  body: { flex: 1, gap: 2, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { flexShrink: 1 },
  tag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, fontSize: 10, lineHeight: 14 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  previewLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  preview: { flex: 1 },
});
