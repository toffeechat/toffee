import { TranslatableText } from '@/components/translatable-text';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CornerUpLeft } from 'lucide-react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FanReplyActions } from '@/components/fan-reply-actions';
import { SideTime } from '@/components/side-time';
import { MediaTile } from '@/components/media-tile';
import { VoiceMessage } from '@/components/voice-message';
import { IconButton } from '@/components/ui/icon-button';
import { DayDivider, sameDay } from '@/components/day-divider';
import type { FanReply } from '@/hooks/use-console';
import { useMessageReplies, useStudioMessages } from '@/hooks/use-studio';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { showNameToken } from '@/utils/name-token';

// 맨 아래(최신)에서 이만큼 안쪽이면 "맨 아래를 보고 있음" — 새 답장이 오면 따라 내려감
const AT_BOTTOM_PX = 80;

/**
 * 스타 메시지 하나에 달린 팬 답장 — 카톡 채팅방처럼: 위에 스타 메시지 고정, 팬 답장은 말풍선으로 오래된 게 위·새 답장이
 * 맨 아래(버블·위버스 방식, 2026-09-28 사용자 결정). 화면은 맨 아래에서 시작하고, 맨 아래를 보고 있으면 새 답장을 따라
 * 올라가며, 위로 올려 예전 답장을 읽는 중이면 끌어내리지 않고 "새 답장 N개 ↓" 버튼만 띄움. 위 끝까지 올리면 이전
 * 답장을 더 불러옴. 신고·차단·답장하기(인용)는 말풍선 옆 ⋯ 메뉴.
 * 팬 답장은 서버가 "보낸 시점의 최신 스타 메시지"로 자동으로 묶어둠.
 */
export default function MessageRepliesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { actorId, messageId } = useLocalSearchParams<{ actorId: string; messageId: string }>();
  const { data: messages } = useStudioMessages(actorId);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessageReplies(actorId, messageId);
  const original = messages?.find((message) => message.id === messageId);

  // 최신 → 오래된 순(서버 순서 그대로) — 뒤집힌(inverted) 목록이라 첫 항목이 맨 아래에 그려짐
  const replies = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flat() ?? []).filter((reply) => !seen.has(reply.id) && seen.add(reply.id));
  }, [data]);

  const listRef = useRef<FlatList<FanReply>>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  // 위로 올려 둔 동안 새로 온 답장 수 — 맨 아래에서 마지막으로 본 최신 답장 id 기준
  const [seenNewestId, setSeenNewestId] = useState<string | undefined>(undefined);
  const newestId = replies[0]?.id;
  const markedNewest = seenNewestId ?? newestId;
  const unseen = atBottom || !markedNewest ? 0 : Math.max(replies.findIndex((r) => r.id === markedNewest), 0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const bottom = event.nativeEvent.contentOffset.y < AT_BOTTOM_PX;
    if (bottom !== atBottom) setAtBottom(bottom);
    // 위로 올리는 순간의 최신 답장을 기억(그 뒤에 온 것만 "새 답장"), 맨 아래로 오면 초기화
    if (!bottom && atBottom) setSeenNewestId(newestId);
    if (bottom && seenNewestId) setSeenNewestId(undefined);
  };

  const quote = (item: FanReply) =>
    // 새 화면을 쌓지 않고 아래에 있던 스튜디오 화면으로 돌아가면서 인용 정보를 넘김
    router.dismissTo({
      pathname: '/studio/[actorId]',
      params: {
        actorId,
        quoteId: item.id,
        quoteNickname: item.fanUser?.nickname ?? '',
        quoteBody: (item.body ?? '').slice(0, 120),
      },
    });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 위에 고정된 원래 메시지 — 토피룸 말풍선과 같은 모양(내 메시지라 오른쪽, 시간은 왼쪽 옆, 2026-10-15 사용자 요청 — 예전엔 연한 상자에 글만) */}
      {original && (
        <ThemedView style={[styles.original, { borderBottomColor: theme.border }]}>
          <ThemedView style={styles.originalLine}>
            {(original.mediaType === 'PHOTO' || original.mediaType === 'VIDEO') && (
              <MediaTile
                id={original.id}
                url={original.mediaUrl}
                mediaType={original.mediaType}
                durationMs={original.mediaDurationMs}
                thumbnailUrl={original.thumbnailUrl}
                thumbhash={original.thumbhash}
                size={{ width: 96, height: 96, radius: Radius.md }}
              />
            )}
            {original.body || original.mediaType === 'AUDIO' ? (
              <ThemedView style={[styles.originalBubble, { backgroundColor: theme.tintSoft }]}>
                {original.mediaType === 'AUDIO' ? (
                  <VoiceMessage id={original.id} url={original.mediaUrl} durationMs={original.mediaDurationMs} waveform={original.waveform} tone="dark" />
                ) : null}
                {original.body ? <ThemedText numberOfLines={4}>{showNameToken(original.body, t('studio.fanNickname'))}</ThemedText> : null}
              </ThemedView>
            ) : null}
            <SideTime at={original.createdAt} />
          </ThemedView>
          <Pressable onPress={() => router.push(`/blocks/${actorId}`)} hitSlop={8} style={styles.blocksLink}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('block.manage')} ›
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={theme.tint} />
      ) : (
        <ThemedView style={styles.listArea}>
          <FlatList
            ref={listRef}
            inverted
            data={replies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onScroll={onScroll}
            scrollEventThrottle={100}
            // 맨 아래 근처면 새 답장을 따라 내려가고, 위로 올려 읽는 중이면 보던 자리를 유지
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: AT_BOTTOM_PX }}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={theme.tint} /> : null}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={[styles.empty, styles.flip]}>
                {t('studio.repliesEmpty')}
              </ThemedText>
            }
            renderItem={({ item, index }) => {
              const older = replies[index + 1];
              return (
                <ThemedView style={styles.transparent}>
                  {(!older || !sameDay(older.createdAt, item.createdAt)) && <DayDivider iso={item.createdAt} />}
                  <ReplyBubble
                    item={item}
                    actorId={actorId}
                    onQuote={() => quote(item)}
                    menuOpen={menuFor === item.id}
                    onMenuChange={(open) => setMenuFor(open ? item.id : null)}
                  />
                </ThemedView>
              );
            }}
          />
          {unseen > 0 && (
            <Pressable
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={[styles.newPill, { backgroundColor: theme.tint }]}
              accessibilityRole="button">
              <ThemedText type="smallBold" style={styles.newPillText}>
                {t('studio.newReplies', { count: unseen })}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      )}
    </SafeAreaView>
  );
}

// 길게 누르면 복사·답장하기·신고·차단(2026-10-14, 시간 옆 ⋯와 같은 메뉴). 팬이 회수한 답장은 "회수된 메시지입니다"
function ReplyBubble({
  item,
  actorId,
  onQuote,
  menuOpen,
  onMenuChange,
}: {
  item: FanReply;
  actorId: string;
  onQuote: () => void;
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.fanRow}>
      {/* 팬 프로필 사진·상태메시지(2026-10-12) — 아티스트·소속사에게만 보임 */}
      <Avatar uri={item.fanUser?.profileImageUrl} size={36} />
      <ThemedView style={styles.row}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {item.fanUser ? `${item.fanUser.nickname ?? t('console.noNickname')} ${item.fanUser.tag}` : t('console.deletedFan')}
        </ThemedText>
        {item.fanUser?.statusMessage ? (
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
            {item.fanUser.statusMessage}
          </ThemedText>
        ) : null}
        <ThemedView style={styles.bubbleLine}>
          {/* 말풍선 + 시간은 한 묶음(시간이 말풍선 아래로 밀려나지 않게, 2026-10-13) */}
          <Pressable
            onLongPress={item.fanUser ? () => onMenuChange(true) : undefined}
            delayLongPress={350}
            accessibilityHint={item.fanUser ? t('chat.messageActions') : undefined}
            style={styles.bubbleWithTime}>
            <ThemedView
              style={[styles.bubble, item.retracted ? [styles.retracted, { borderColor: theme.border, backgroundColor: theme.backgroundElement }] : { backgroundColor: theme.backgroundElement }]}>
              {item.retracted ? (
                <ThemedText type="small" themeColor="textTertiary">
                  {t('retract.placeholder')}
                </ThemedText>
              ) : item.body ? (
                // 태국·일본 팬 답장 등 다른 언어면 "번역 보기"
                <TranslatableText actorId={actorId} messageId={item.id} text={item.body} fanReply />
              ) : null}
            </ThemedView>
            <SideTime at={item.createdAt} />
          </Pressable>
          {/* 바로 답장하기 화살표(2026-10-15 사용자 요청 — 예전엔 길게 누르거나 ⋯ 메뉴 안에만 있었음) */}
          {item.fanUser && !item.retracted && item.body && !menuOpen ? (
            <IconButton icon={CornerUpLeft} size={18} label={t('quote.action')} color={theme.tint} onPress={onQuote} style={styles.quickReply} />
          ) : null}
          {/* 시간 옆 ⋯ — 펼치면 복사·답장하기·신고·차단(좁으면 다음 줄로) */}
          {item.fanUser && (
            <FanReplyActions
              actorId={actorId}
              messageId={item.id}
              fanUserId={item.fanUser.id}
              nickname={item.fanUser.nickname ?? ''}
              body={item.retracted ? null : item.body}
              open={menuOpen}
              onOpenChange={onMenuChange}
            />
          )}
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  original: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.one, borderBottomWidth: StyleSheet.hairlineWidth },
  originalLine: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, backgroundColor: 'transparent' },
  originalBubble: { borderRadius: Radius.lg + 2, paddingHorizontal: 14, paddingVertical: 10, gap: 6, flexShrink: 1, maxWidth: '80%' },
  loading: { marginTop: Spacing.six },
  listArea: { flex: 1 },
  // 뒤집힌 목록이라 flex-end = 화면 위쪽 — 답장이 적으면 원래 메시지 바로 아래부터 쌓이고(2026-10-15 사용자 요청, 예전엔 맨 아래에 붙음),
  // 화면을 넘으면 맨 아래(최신)를 보여 주며 새 답장을 따라 내려감
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1, justifyContent: 'flex-end' },
  flip: { transform: [{ scaleY: -1 }] },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  blocksLink: { alignSelf: 'flex-end' },
  fanRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, backgroundColor: 'transparent' },
  row: { flex: 1, gap: 4, alignItems: 'flex-start', backgroundColor: 'transparent' },
  bubbleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: Spacing.two, rowGap: Spacing.one, backgroundColor: 'transparent' },
  bubbleWithTime: { flexDirection: 'row', alignItems: 'flex-end', columnGap: 6, flexShrink: 1, maxWidth: '88%', backgroundColor: 'transparent' },
  bubble: { borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexShrink: 1 },
  quickReply: { width: 28, height: 28 },
  retracted: { borderWidth: StyleSheet.hairlineWidth },
  transparent: { backgroundColor: 'transparent' },
  newPill: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  newPillText: { color: '#fff' },
});
