import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Copy, Images, MessageCircle, MoreHorizontal, Undo2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/themed-text';
import { ChatPhotoEditor } from '@/components/chat-photo-editor';
import { showNameToken } from '@/utils/name-token';
import { ThemedView } from '@/components/themed-view';
import { FanReplyActions } from '@/components/fan-reply-actions';
import { SideTime } from '@/components/side-time';
import { DayDivider, sameDay } from '@/components/day-divider';
import { MessageMenu } from '@/components/message-menu';
import { copyText } from '@/lib/copy-text';
import { useActor } from '@/hooks/use-actors';
import { useActorStats, useActorReplies, useActorStories, type FanReply, type ActorStory, type StatsSelection } from '@/hooks/use-console';
import { DistributionBars, Panel } from '@/components/console-charts';
import { AudiencePanels, KpiGrid, RangeCaption, ScreenIntro, TrendPanels, cellStyle, statsStyles } from '@/components/console-stats';
import { StatsRangeControl } from '@/components/stats-range-picker';
import { useDeleteBroadcast, useStudioMessages, type StudioMessage } from '@/hooks/use-studio';
import { MediaTile } from '@/components/media-tile';
import { QuoteBlock } from '@/components/quote-block';
import { VoiceMessage } from '@/components/voice-message';
import { TranslatableText } from '@/components/translatable-text';
import { IconButton } from '@/components/ui/icon-button';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

type Section = 'monitor' | 'replies' | 'stats';

const MEDIA_TYPES = new Set(['PHOTO', 'AUDIO', 'VIDEO']);

function mediaLabel(t: TFunction, mediaType: string) {
  return t(`console.media.${MEDIA_TYPES.has(mediaType) ? mediaType : 'TEXT'}`);
}

function SegmentedControl({ value, onChange }: { value: Section; onChange: (section: Section) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const options: { key: Section; label: string }[] = [
    { key: 'monitor', label: t('console.tabs.monitor') },
    { key: 'replies', label: t('console.tabs.replies') },
    { key: 'stats', label: t('console.tabs.stats') },
  ];
  return (
    <ThemedView style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={[styles.segment, value === opt.key && { backgroundColor: theme.tint }]}>
          <ThemedText type="smallBold" style={value === opt.key ? styles.segmentTextActive : undefined}>
            {opt.label}
          </ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}


type MonitorItem =
  | { kind: 'message'; createdAt: string; message: StudioMessage }
  | { kind: 'story'; createdAt: string; story: ActorStory };

/**
 * 소속사 모니터링(2026-10-12 사용자 결정: 카드 목록 → 팬이 보는 대화방 모양) — 아티스트 메시지가 왼쪽 말풍선으로, 사진·영상·음성도
 * 그대로 보임. 소속사는 보내기·답장은 못 하고, 사고 대응용으로 메시지를 대신 지울 수 있음(팬 화면에선 흔적 없이 사라짐).
 * 지워진 메시지는 기록용으로 흐리게 + 누가 지웠는지.
 */
function MonitorSection({ actorId, onOpenReplies }: { actorId: string; onOpenReplies: (messageId: string) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { data: actor } = useActor(actorId);
  const { data: broadcasts, isLoading: loadingBroadcasts } = useStudioMessages(actorId);
  const { data: stories, isLoading: loadingStories } = useActorStories(actorId);
  const remove = useDeleteBroadcast(actorId);
  const [failed, setFailed] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (loadingBroadcasts || loadingStories) return <ActivityIndicator style={styles.loading} color={theme.tint} />;

  // 최신이 맨 아래(뒤집힌 목록이라 최신순 그대로)
  const items: MonitorItem[] = [
    ...(broadcasts ?? []).map((message): MonitorItem => ({ kind: 'message', createdAt: message.createdAt, message })),
    ...(stories ?? []).map((story): MonitorItem => ({ kind: 'story', createdAt: story.createdAt, story })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const removeMessage = async (messageId: string) => {
    if (!(await confirm(t('retract.title'), t('retract.agencyBody'), t('retract.action'), t('common.cancel')))) return;
    setFailed(null);
    remove.mutate(messageId, { onError: (error) => setFailed(error instanceof ApiError ? error.message : t('common.requestFailed')) });
  };

  return (
    <>
      {failed ? (
        <ThemedText type="small" themeColor="danger" style={styles.sectionNote}>
          {failed}
        </ThemedText>
      ) : null}
      <FlatList
        inverted
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.kind === 'message' ? item.message.id : item.story.id}`}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={[styles.emptyMessage, styles.flip]}>
            {t('console.monitorEmpty')}
          </ThemedText>
        }
        renderItem={({ item, index }) => {
          const older = items[index + 1];
          const dayChanged = !older || !sameDay(older.createdAt, item.createdAt);
          return (
            <View>
              {dayChanged ? <DayDivider iso={item.createdAt} /> : null}
              {item.kind === 'story' ? (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.storyLine}>
                  {`${t('console.kind.story')} · ${mediaLabel(t, item.story.mediaType)} · ${new Date(item.createdAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}`}
                </ThemedText>
              ) : (
                <MonitorBubble
                  message={item.message}
                  avatarUri={item.message.sender?.chatProfileImageUrl ?? actor?.chatProfileImageUrl}
                  name={item.message.sender?.chatDisplayName ?? actor?.chatDisplayName ?? ''}
                  onDelete={() => void removeMessage(item.message.id)}
                  onOpenReplies={() => onOpenReplies(item.message.id)}
                  menuOpen={menuFor === item.message.id}
                  onMenuChange={(open) => setMenuFor(open ? item.message.id : null)}
                />
              )}
            </View>
          );
        }}
      />
    </>
  );
}

// 2026-10-14 사용자 피드백: 시간은 마지막 말풍선 바로 옆(사진+글이면 예전엔 떨어져 보였음), 휴지통 대신 길게 누르기(웹은 시간 옆 ⋯) → 복사 · 회수
function MonitorBubble({
  message,
  avatarUri,
  name,
  onDelete,
  onOpenReplies,
  menuOpen,
  onMenuChange,
}: {
  message: StudioMessage;
  avatarUri?: string | null;
  name: string;
  onDelete: () => void;
  onOpenReplies: () => void;
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isMedia = message.mediaType === 'PHOTO' || message.mediaType === 'VIDEO';
  const removedBy = message.deletedAt ? (message.deletedByAdmin ? 'admin' : message.deletedByStaffId ? 'agency' : 'actor') : null;
  const time = new Date(message.createdAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  const bodyText = message.body ? showNameToken(message.body, t('studio.fanNickname')) : null;
  const side = (
    <View style={styles.side}>
      <ThemedText type="caption" themeColor="textTertiary" style={styles.time}>
        {time}
      </ThemedText>
      {/* 웹(PC)은 마우스로 길게 누르기가 어색해서 시간 옆 ⋯로도 */}
      {!removedBy && Platform.OS === 'web' ? (
        <IconButton icon={MoreHorizontal} size={15} label={t('chat.messageActions')} color={theme.textTertiary} onPress={() => onMenuChange(true)} style={styles.more} />
      ) : null}
    </View>
  );
  const textBubble =
    !isMedia || message.body ? (
      <View style={[styles.bubble, styles.bubbleBody, { backgroundColor: theme.backgroundElement }]}>
        {message.mediaType === 'AUDIO' ? (
          <VoiceMessage id={message.id} url={message.mediaUrl} durationMs={message.mediaDurationMs} waveform={message.waveform} tone="dark" />
        ) : null}
        {bodyText ? <ThemedText>{bodyText}</ThemedText> : null}
      </View>
    ) : null;
  return (
    <View style={styles.bubbleRow}>
      <Avatar uri={avatarUri} size={36} />
      <View style={styles.bubbleColumn}>
        <ThemedText type="captionBold" themeColor="textSecondary">
          {name}
        </ThemedText>
        {removedBy ? (
          <ThemedText type="caption" themeColor="danger">
            {t(removedBy === 'admin' ? 'studio.hiddenByAdmin' : removedBy === 'agency' ? 'console.deletedByAgency' : 'console.deletedByActor')}
          </ThemedText>
        ) : null}
        {/* 인용한 팬 답장은 따로 선 말풍선으로(2026-10-15, 팬 화면과 같게) */}
        {message.replyTo ? <QuoteBlock quote={message.replyTo} tone="dark" standalone /> : null}
        <Pressable
          onLongPress={removedBy ? undefined : () => onMenuChange(true)}
          delayLongPress={350}
          style={[styles.bubbleStack, removedBy && styles.removed]}>
          {isMedia ? (
            <View style={styles.bubbleLine}>
              <MediaTile
                id={message.id}
                url={message.mediaUrl}
                mediaType={message.mediaType as 'PHOTO' | 'VIDEO'}
                durationMs={message.mediaDurationMs}
                thumbnailUrl={message.thumbnailUrl}
                thumbhash={message.thumbhash}
              />
              {textBubble ? null : side}
            </View>
          ) : null}
          {textBubble ? (
            <View style={styles.bubbleLine}>
              {textBubble}
              {side}
            </View>
          ) : null}
        </Pressable>
        {menuOpen ? (
          <MessageMenu
            onClose={() => onMenuChange(false)}
            actions={[
              ...(bodyText ? [{ key: 'copy', label: t('chat.copy'), icon: Copy, onPress: () => (onMenuChange(false), copyText(bodyText)) }] : []),
              { key: 'retract', label: t('retract.action'), icon: Undo2, danger: true, onPress: () => (onMenuChange(false), onDelete()) },
            ]}
          />
        ) : null}
        <Pressable onPress={onOpenReplies} hitSlop={8} accessibilityRole="button">
          <ThemedText type="captionBold" style={{ color: theme.tint }}>
            {message.replyCount > 0 ? `${t('studio.replies', { count: message.replyCount })} ›` : t('studio.noReplies')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/** 팬 답장 — 대화방처럼 왼쪽 말풍선(팬 사진·닉네임·상태메시지), 소속사는 답장은 못 하고 복사·신고·차단만(길게 누르기·⋯, 2026-10-14) */
function ReplyBubble({ reply, actorId, menuOpen, onMenuChange }: { reply: FanReply; actorId: string; menuOpen: boolean; onMenuChange: (open: boolean) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const fan = reply.fanUser;
  return (
    <View style={styles.bubbleRow}>
      <Avatar uri={fan?.profileImageUrl} size={36} />
      <View style={styles.bubbleColumn}>
        <ThemedText type="captionBold" themeColor="textSecondary" numberOfLines={1}>
          {fan ? `${fan.nickname ?? t('console.noNickname')} ${fan.tag}` : t('console.deletedFan')}
        </ThemedText>
        {fan?.statusMessage ? (
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
            {fan.statusMessage}
          </ThemedText>
        ) : null}
        <View style={styles.bubbleLine}>
          <Pressable
            onLongPress={fan ? () => onMenuChange(true) : undefined}
            delayLongPress={350}
            style={[styles.bubble, styles.bubbleBody, reply.retracted ? [styles.retracted, { borderColor: theme.border }] : { backgroundColor: theme.backgroundElement }]}>
            {reply.retracted ? (
              <ThemedText type="small" themeColor="textTertiary">
                {t('retract.placeholder')}
              </ThemedText>
            ) : (
              <TranslatableText actorId={actorId} messageId={reply.id} text={reply.body ?? ''} />
            )}
          </Pressable>
          <SideTime at={reply.createdAt} />
          {fan ? (
            <FanReplyActions
              actorId={actorId}
              messageId={reply.id}
              fanUserId={fan.id}
              nickname={fan.nickname ?? ''}
              body={reply.retracted ? null : reply.body}
              open={menuOpen}
              onOpenChange={onMenuChange}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function RepliesSection({ actorId, messageId, onClearFilter }: { actorId: string; messageId: string | null; onClearFilter: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: replies, isLoading } = useActorReplies(actorId, messageId);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (isLoading) return <ActivityIndicator style={styles.loading} color={theme.tint} />;

  return (
    <>
      <View style={styles.repliesHeader}>
        {messageId ? (
          <Pressable onPress={onClearFilter} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {`‹ ${t('console.allReplies')}`}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={() => router.push(`/blocks/${actorId}`)} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('block.manage')} ›
          </ThemedText>
        </Pressable>
      </View>
      <FlatList
        inverted
        data={replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={[styles.emptyMessage, styles.flip]}>
            {t('console.repliesEmpty')}
          </ThemedText>
        }
        renderItem={({ item, index }) => {
          const older = replies?.[index + 1];
          return (
            <View>
              {!older || !sameDay(older.createdAt, item.createdAt) ? <DayDivider iso={item.createdAt} /> : null}
              <ReplyBubble reply={item} actorId={actorId} menuOpen={menuFor === item.id} onMenuChange={(open) => setMenuFor(open ? item.id : null)} />
            </View>
          );
        }}
      />
    </>
  );
}

/**
 * 아티스트별 통계(2026-10-13 개편, 사용자 요청: "덜렁 카드 두 개 → 대시보드처럼 그래프로") — 대시보드와 같은 숫자 카드·추이 +
 * 메시지 종류·답장이 많았던 메시지(누르면 그 답장) + 팬 나라·언어. 기간은 최근 N일 또는 직접 고른 날짜(최대 1년). GET /actors/:id/stats
 */
function StatsSection({ actorId, onOpenReplies }: { actorId: string; onOpenReplies: (messageId: string) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [selection, setSelection] = useState<StatsSelection>({ days: 30 });
  const [width, setWidth] = useState(0);
  const { data: stats, isLoading } = useActorStats(actorId, selection);
  const half = cellStyle(width, width >= 900 ? 2 : 1);

  return (
    <ScrollView contentContainerStyle={styles.statsContent} style={{ backgroundColor: theme.backgroundElement }}>
      <View style={styles.statsInner} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={statsStyles.filters}>
          <StatsRangeControl value={selection} onChange={setSelection} />
        </View>
        {isLoading || !stats ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : (
          <>
            <RangeCaption range={stats} />
            <ThemedText type="caption" themeColor="textTertiary">
              {`${t('console.lastBroadcast')} ${stats.lastBroadcastAt ? new Date(stats.lastBroadcastAt).toLocaleDateString(i18n.language) : t('console.noBroadcast')}`}
            </ThemedText>
            <KpiGrid
              width={width}
              days={stats.days}
              subscribers={stats.subscriberCount}
              asOf={stats.audienceAsOf}
              netChange={stats.totals.newSubscriptions - stats.totals.cancellations}
              totals={stats.totals}
              previous={stats.previous}
              daily={stats.daily}
            />
            <TrendPanels width={width} daily={stats.daily} bucket={stats.bucket} />
            <View style={styles.statsGrid}>
              <Panel title={t('dashboard.mediaMix')} icon={Images} style={half}>
                <DistributionBars rows={stats.mediaMix} labelOf={(key) => mediaLabel(t, key)} emptyText={t('dashboard.noMessages')} />
              </Panel>
              <Panel title={t('dashboard.topMessages')} icon={MessageCircle} style={half}>
                {stats.topMessages.length === 0 ? (
                  <ThemedText type="small" themeColor="textTertiary" style={styles.emptyMessage}>
                    {t('dashboard.noReplies')}
                  </ThemedText>
                ) : (
                  stats.topMessages.map((message, index) => (
                    <Pressable
                      key={message.id}
                      onPress={() => onOpenReplies(message.id)}
                      accessibilityRole="button"
                      style={({ hovered, pressed }) => [styles.topMessage, (hovered || pressed) && { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="captionBold" style={[styles.topRank, { color: index === 0 ? theme.tint : theme.textTertiary }]}>
                        {index + 1}
                      </ThemedText>
                      <View style={styles.topBody}>
                        <ThemedText type="small" numberOfLines={2}>
                          {message.body ? showNameToken(message.body, t('studio.fanNickname')) : `[${mediaLabel(t, message.mediaType)}]`}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textTertiary">
                          {new Date(message.createdAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold" style={{ color: theme.tint }}>
                        {t('dashboard.countItems', { count: message.replyCount })}
                      </ThemedText>
                    </Pressable>
                  ))
                )}
              </Panel>
            </View>
            <AudiencePanels width={width} fans={stats.fans} countries={stats.countries} languages={stats.languages} asOf={stats.audienceAsOf} recorded={stats.audienceRecorded} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

export default function ConsoleActorScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { actorId } = useLocalSearchParams<{ actorId: string }>();
  const { data: actor } = useActor(actorId);
  const [section, setSection] = useState<Section>('monitor');
  // 모니터링에서 "답장 N개"를 누르면 답장 탭에서 그 메시지 답장만
  const [replyFilter, setReplyFilter] = useState<string | null>(null);

  useEffect(() => {
    if (actor) navigation.setOptions({ title: actor.chatDisplayName });
  }, [actor, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SegmentedControl
        value={section}
        onChange={(next) => {
          setReplyFilter(null);
          setSection(next);
        }}
      />
      {/* 탭마다 무슨 화면인지 한 줄(2026-10-13 사용자 요청) */}
      <ScreenIntro text={t(`console.tabHint.${section}`)} style={styles.intro} />
      {actor && section === 'monitor' && (
        <ThemedView style={styles.actorPreview}>
          <Avatar uri={actor.chatProfileImageUrl} size={24} />
          <ThemedView style={styles.actorPreviewBody}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('console.monitoring', { name: actor.legalName })}
            </ThemedText>
            <ChatPhotoEditor actorId={actor.id} hasPhoto={!!actor.chatProfileImageUrl} />
            {/* 토피룸 배경 사진(2026-10-14) — 소속사도 바꾸기·기본으로 */}
            <ChatPhotoEditor actorId={actor.id} hasPhoto={!!actor.chatBackgroundUrl} target="background" />
          </ThemedView>
        </ThemedView>
      )}
      {section === 'monitor' && (
        <MonitorSection
          actorId={actorId}
          onOpenReplies={(messageId) => {
            setReplyFilter(messageId);
            setSection('replies');
          }}
        />
      )}
      {section === 'replies' && <RepliesSection actorId={actorId} messageId={replyFilter} onClearFilter={() => setReplyFilter(null)} />}
      {section === 'stats' && (
        <StatsSection
          actorId={actorId}
          onOpenReplies={(messageId) => {
            setReplyFilter(messageId);
            setSection('replies');
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actorPreviewBody: { flex: 1, gap: 4, backgroundColor: 'transparent' },
  chatList: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  flip: { transform: [{ scaleY: -1 }] },
  storyLine: { textAlign: 'center', marginVertical: Spacing.two },
  sectionNote: { paddingHorizontal: Spacing.four },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, marginBottom: Spacing.three },
  bubbleColumn: { flex: 1, gap: 4, alignItems: 'flex-start' },
  bubbleLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, maxWidth: '100%' },
  bubbleStack: { gap: 4, maxWidth: '100%', alignItems: 'flex-start' },
  side: { flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  more: { width: 28, height: 28 },
  retracted: { borderWidth: StyleSheet.hairlineWidth },
  bubbleBody: { flexShrink: 1, gap: 4 },
  bubble: { borderRadius: Radius.lg + 2, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  time: { flexShrink: 0, paddingBottom: 2 },
  removed: { opacity: 0.45 },
  repliesHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  container: { flex: 1 },
  segments: { flexDirection: 'row', margin: Spacing.four, borderRadius: 10, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: 8 },
  segmentTextActive: { color: '#fff' },
  actorPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  section: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  emptyMessage: { textAlign: 'center', marginTop: Spacing.four },
  loading: { marginTop: Spacing.six },
  intro: { marginHorizontal: Spacing.four, marginBottom: Spacing.two },
  statsContent: { padding: Spacing.three, paddingBottom: Spacing.five },
  statsInner: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: Spacing.three },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  topMessage: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6, paddingHorizontal: 4, borderRadius: Radius.md },
  topRank: { width: 18, textAlign: 'center' },
  topBody: { flex: 1, gap: 2, minWidth: 0 },
});
