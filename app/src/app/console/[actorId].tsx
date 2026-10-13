import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Images, MessageCircle, Trash2 } from 'lucide-react-native';
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
import { useActor } from '@/hooks/use-actors';
import { useActorStats, useActorReplies, useActorStories, type FanReply, type ActorStory, type StatsPeriod } from '@/hooks/use-console';
import { DistributionBars, Panel } from '@/components/console-charts';
import { AudiencePanels, KpiGrid, PeriodPills, ScreenIntro, TrendPanels, cellStyle, statsStyles } from '@/components/console-stats';
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

// 날짜 구분 줄·같은 분 묶음 — 팬 채팅방과 같은 기준
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

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

  if (loadingBroadcasts || loadingStories) return <ActivityIndicator style={styles.loading} color={theme.tint} />;

  // 최신이 맨 아래(뒤집힌 목록이라 최신순 그대로)
  const items: MonitorItem[] = [
    ...(broadcasts ?? []).map((message): MonitorItem => ({ kind: 'message', createdAt: message.createdAt, message })),
    ...(stories ?? []).map((story): MonitorItem => ({ kind: 'story', createdAt: story.createdAt, story })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const removeMessage = async (messageId: string) => {
    if (!(await confirm(t('console.deleteTitle'), t('console.deleteBody'), t('console.deleteConfirm'), t('common.cancel')))) return;
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
              {dayChanged ? (
                <ThemedText type="caption" themeColor="textTertiary" style={styles.day}>
                  {new Date(item.createdAt).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', weekday: 'short' })}
                </ThemedText>
              ) : null}
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
                />
              )}
            </View>
          );
        }}
      />
    </>
  );
}

function MonitorBubble({
  message,
  avatarUri,
  name,
  onDelete,
  onOpenReplies,
}: {
  message: StudioMessage;
  avatarUri?: string | null;
  name: string;
  onDelete: () => void;
  onOpenReplies: () => void;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isMedia = message.mediaType === 'PHOTO' || message.mediaType === 'VIDEO';
  const removedBy = message.deletedAt ? (message.deletedByAdmin ? 'admin' : message.deletedByStaffId ? 'agency' : 'actor') : null;
  const time = new Date(message.createdAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
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
        <View style={[styles.bubbleLine, removedBy && styles.removed]}>
          <View style={styles.bubbleBody}>
            {isMedia ? (
              <MediaTile
                id={message.id}
                url={message.mediaUrl}
                mediaType={message.mediaType as 'PHOTO' | 'VIDEO'}
                durationMs={message.mediaDurationMs}
                thumbnailUrl={message.thumbnailUrl}
                thumbhash={message.thumbhash}
              />
            ) : null}
            {!isMedia || message.body ? (
              <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
                {message.replyTo ? <QuoteBlock quote={message.replyTo} tone="dark" /> : null}
                {message.mediaType === 'AUDIO' ? (
                  <VoiceMessage id={message.id} url={message.mediaUrl} durationMs={message.mediaDurationMs} waveform={message.waveform} tone="dark" />
                ) : null}
                {message.body ? <ThemedText>{showNameToken(message.body, t('studio.fanNickname'))}</ThemedText> : null}
              </View>
            ) : null}
          </View>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.time}>
            {time}
          </ThemedText>
        </View>
        <View style={styles.bubbleMeta}>
          <Pressable onPress={onOpenReplies} hitSlop={8} accessibilityRole="button">
            <ThemedText type="captionBold" style={{ color: theme.tint }}>
              {message.replyCount > 0 ? `${t('studio.replies', { count: message.replyCount })} ›` : t('studio.noReplies')}
            </ThemedText>
          </Pressable>
          {!removedBy ? (
            <IconButton icon={Trash2} size={15} label={t('console.deleteConfirm')} color={theme.textTertiary} onPress={onDelete} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** 팬 답장 — 대화방처럼 왼쪽 말풍선(팬 사진·닉네임·상태메시지), 소속사는 답장은 못 하고 신고·차단만(2026-10-12) */
function ReplyBubble({ reply, actorId }: { reply: FanReply; actorId: string }) {
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
          <View style={[styles.bubble, styles.bubbleBody, { backgroundColor: theme.backgroundElement }]}>
            <TranslatableText actorId={actorId} messageId={reply.id} text={reply.body ?? ''} />
          </View>
          {/* 날짜·시간 두 줄로 말풍선 옆에(2026-10-13, 아티스트 팬 답장 화면과 같은 모양) */}
          <SideTime at={reply.createdAt} />
          {fan ? <FanReplyActions actorId={actorId} messageId={reply.id} fanUserId={fan.id} nickname={fan.nickname ?? ''} /> : null}
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
        renderItem={({ item }) => <ReplyBubble reply={item} actorId={actorId} />}
      />
    </>
  );
}

/**
 * 아티스트별 통계(2026-10-13 개편, 사용자 요청: "덜렁 카드 두 개 → 대시보드처럼 그래프로") — 대시보드와 같은 숫자 카드·추이 +
 * 메시지 종류·답장이 많았던 메시지(누르면 그 답장) + 팬 나라·언어. GET /actors/:id/stats?days=
 */
function StatsSection({ actorId, onOpenReplies }: { actorId: string; onOpenReplies: (messageId: string) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<StatsPeriod>(30);
  const [width, setWidth] = useState(0);
  const { data: stats, isLoading } = useActorStats(actorId, days);
  const half = cellStyle(width, width >= 900 ? 2 : 1);

  return (
    <ScrollView contentContainerStyle={styles.statsContent} style={{ backgroundColor: theme.backgroundElement }}>
      <View style={styles.statsInner} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={statsStyles.filters}>
          <PeriodPills value={days} onChange={setDays} />
        </View>
        {isLoading || !stats ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : (
          <>
            <ThemedText type="caption" themeColor="textTertiary">
              {`${t('dashboard.basis', { days })} · ${t('console.lastBroadcast')} ${
                stats.lastBroadcastAt ? new Date(stats.lastBroadcastAt).toLocaleDateString(i18n.language) : t('console.noBroadcast')
              }`}
            </ThemedText>
            <KpiGrid
              width={width}
              days={days}
              subscribers={stats.subscriberCount}
              netChange={stats.totals.newSubscriptions - stats.totals.cancellations}
              totals={stats.totals}
              previous={stats.previous}
              daily={stats.daily}
            />
            <TrendPanels width={width} daily={stats.daily} />
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
            <AudiencePanels width={width} fans={stats.fans} countries={stats.countries} languages={stats.languages} />
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
  day: { textAlign: 'center', marginVertical: Spacing.three },
  storyLine: { textAlign: 'center', marginVertical: Spacing.two },
  sectionNote: { paddingHorizontal: Spacing.four },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, marginBottom: Spacing.three },
  bubbleColumn: { flex: 1, gap: 4, alignItems: 'flex-start' },
  bubbleLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, maxWidth: '100%' },
  bubbleBody: { flexShrink: 1, gap: 4 },
  bubble: { borderRadius: Radius.lg + 2, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  time: { flexShrink: 0, paddingBottom: 2 },
  removed: { opacity: 0.45 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
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
