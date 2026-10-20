import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { type LucideIcon, ArrowUp, Bell, BellOff, ChevronDown, ChevronUp, CloudOff, Copy, CreditCard, Ellipsis, Flag, Images, Lock, MessageCircleHeart, Search, Undo2, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { MediaTile } from '@/components/media-tile';
import { ChatBackground } from '@/components/chat-background';
import { DayDivider, sameDay } from '@/components/day-divider';
import { MessageMenu } from '@/components/message-menu';
import { AlbumGrid } from '@/components/album-grid';
import { ScrollToBottomButton } from '@/components/scroll-to-bottom-button';
import { QuoteBlock } from '@/components/quote-block';
import { needsTranslation } from '@/utils/detect-script';
import { TranslatableText } from '@/components/translatable-text';
import { MessageText } from '@/components/message-text';
import { VoiceMessage } from '@/components/voice-message';
import { ApiError } from '@/lib/api-client';
import { saveMedia } from '@/lib/save-media';
import { useActor } from '@/hooks/use-actors';
import { useActorMessages, useChatExtras, useChatSearch, useReplyQuota, useRetractReply, useSendReply, type ChatMessage } from '@/hooks/use-messages';
import { useMySubscriptions, useSetNotificationsMuted, type Subscription } from '@/hooks/use-subscriptions';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import { fontFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { confirm } from '@/lib/confirm';
import { useAcceptReplyRules, useAutoTranslate, useOnboardingStatus } from '@/hooks/use-onboarding';
import { useScreenshotWarning } from '@/hooks/use-screenshot-warning';
import { collapseRetracted, groupAlbumRows, rowHas } from '@/utils/chat-album';

// 맨 아래(최신)에서 이만큼 안쪽이면 "맨 아래를 보고 있음" — 새 메시지를 따라감
const AT_BOTTOM_PX = 80;
// 알림·검색 결과로 이동할 메시지가 아직 안 불러온 예전 메시지면 이만큼(50개씩)까지만 더 불러옴 — 너무 오래된 건 안내만
const MAX_FOCUS_PAGES = 20;

// 카톡처럼 같은 사람이 같은 시:분에 이어 보낸 메시지가 한 묶음 — 프로필 사진·이름은 묶음 첫 메시지 위, 시간은 마지막 메시지에 한 번
const sameMinute = (a: string, b: string) => Math.floor(new Date(a).getTime() / 60_000) === Math.floor(new Date(b).getTime() / 60_000);

// 환영 메시지·생일 축하 — 서버 메시지가 아니라 목록에만 끼워 넣는 말풍선(신고·번역 없음, 복사만)
// album: 같은 분에 연달아 온 글 없는 사진·영상 묶음(카톡처럼 격자 한 칸, 2026-10-13) — 시간순. 묶음 줄의 나머지 값은 가장 최근 것
type ChatItem = ChatMessage & { extra?: 'welcome' | 'birthday'; album?: ChatMessage[] };
const groupAlbums = (messages: ChatItem[]) => collapseRetracted(groupAlbumRows(messages, sameMinute), sameMinute);
const extraMessage = (actorId: string, id: string, body: string, createdAt: string, extra: ChatItem['extra']): ChatItem => ({
  id,
  actorId,
  senderType: 'ARTIST',
  fanUserId: null,
  mediaType: 'TEXT',
  body,
  mediaUrl: null,
  createdAt,
  extra,
});

/**
 * 팬 채팅방 — 시안 2A Minimal Premium(docs/product/brand/exploration/2a-chat-minimal-premium.png) + DESIGN_GUIDE §9.
 * 실제 1:1 DM처럼 조용하고 여백 있게: 스타는 왼쪽 Cloud 말풍선(묶음 첫 메시지 위에 프로필 사진·이름), 팬은 오른쪽 Periwinkle.
 * 헤더 이름이나 프로필 사진을 누르면 대화방 프로필 카드(chat-profile), 헤더 ⋯에 모아보기·알림·구독 관리.
 * 팬은 글·이모지만(사진·음성·영상 없음). 말풍선을 길게 누르면 복사(글이 있을 때)·신고(스타 메시지) 메뉴(말풍선마다 버튼을 늘어놓지 않음).
 * 목록은 최신이 맨 아래인 뒤집힌 목록 — 맨 아래를 보고 있으면 새 메시지를 따라가고, 위로 올려 읽는 중이면 끌어내리지
 * 않고 "새 메시지 N개 ↓"만(예전엔 사진 로딩·폴링 때마다 맨 아래로 끌려 내려갔음). 위 끝까지 올리면 이전 대화를 더 불러옴.
 */
export default function ChatRoomScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  // focus: 푸시 알림을 눌러 들어왔을 때 보여줄 메시지 id(없거나 목록에 없으면 평소처럼 맨 아래)
  const { actorId, focus } = useLocalSearchParams<{ actorId: string; focus?: string }>();
  const { data: actor } = useActor(actorId);
  const isCouple = actor?.kind === 'COUPLE';
  const { data: subscriptions, isFetched: subscriptionsFetched } = useMySubscriptions();
  const subscription = subscriptions?.find((s) => s.actorId === actorId);
  const setMuted = useSetNotificationsMuted(actorId);
  // 대화를 불러오면 서버가 읽음 시각을 지금으로 바꾸므로, 구독 목록(들어오기 전 읽음 시각 → "여기까지 읽었어요")을 먼저 받은 뒤에 불러옴.
  // 안 기다리면 새로고침·주소로 바로 열기·앱이 꺼진 상태에서 알림으로 들어올 때 이미 바뀐 시각을 받아 줄이 안 보였음(2026-10-20)
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useActorMessages(actorId, {
    enabled: subscriptionsFetched,
  });
  const notSubscribed = error instanceof ApiError && error.status === 403;
  // 들어오면 토피룸 목록의 이 방 안 읽음 숫자를 바로 0으로, 나가면 목록을 바로 새로(2026-10-15 실기기 — 서버는 대화를 불러올 때 읽음 처리하는데
  // 목록은 받아 둔 걸 보여 주다 30초마다 새로 받아서, 알림 눌러 보고 돌아와도 숫자가 한참 남아 있었음)
  const queryClient = useQueryClient();
  const loaded = !!data;
  useEffect(() => {
    if (!loaded) return;
    queryClient.setQueryData<Subscription[]>(['my-subscriptions'], (subs) =>
      subs?.map((sub) => (sub.actorId === actorId ? { ...sub, unreadCount: 0, unreadQuotedReply: false } : sub)),
    );
    return () => void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
  }, [loaded, actorId, queryClient]);
  const sendReply = useSendReply(actorId);
  const retractReply = useRetractReply(actorId);
  const { data: onboarding } = useOnboardingStatus();
  const acceptReplyRules = useAcceptReplyRules();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const openProfile = useCallback(
    (memberId?: string) => router.push({ pathname: '/chat-profile/[actorId]', params: { actorId, ...(memberId ? { memberId } : {}) } }),
    [router, actorId],
  );

  // 최신 → 오래된 순(서버 순서) — 뒤집힌 목록이라 첫 항목이 맨 아래
  // 화면 캡처하면 "구독자 전용, 외부 공유 금지" 안내(막지는 않음)
  useScreenshotWarning(!notSubscribed);
  const { data: extras } = useChatExtras(actorId, !!data && !notSubscribed);
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const loaded: ChatItem[] = (data?.pages.flat() ?? []).filter((m) => !seen.has(m.id) && seen.add(m.id));
    if (!extras) return loaded;
    const extraItems: ChatItem[] = [
      ...(extras.welcome ? [extraMessage(actorId, 'extra-welcome', extras.welcome.body, extras.welcome.createdAt, 'welcome')] : []),
      ...extras.birthdays.map((b) => extraMessage(actorId, `extra-birthday-${b.id}`, b.body, b.createdAt, 'birthday')),
    ];
    // 아직 안 불러온 예전 구간에 속하는 건 그 구간을 불러올 때 끼움(중간에 엉뚱하게 보이지 않게)
    const oldestLoaded = loaded[loaded.length - 1]?.createdAt;
    const visible = extraItems.filter((item) => !hasNextPage || !oldestLoaded || item.createdAt >= oldestLoaded);
    return [...loaded, ...visible].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [data, extras, hasNextPage, actorId]);

  // "여기까지 읽었어요"(2026-10-13, 카톡처럼) — 들어올 때의 마지막으로 읽은 시각. 대화방을 열면 서버가 바로 지금으로 바꾸므로
  // 처음 본 값을 고정하고, 화면을 연 뒤에 받은 값(이미 지금으로 바뀐 값)은 버림. 처음 들어온 방(lastReadAt 없음)은 표시 안 함
  const [openedAt] = useState(() => Date.now());
  const [readMarker, setReadMarker] = useState<string | null | undefined>(undefined);
  if (readMarker === undefined && subscription) {
    const last = subscription.lastReadAt;
    setReadMarker(last && new Date(last).getTime() < openedAt - 2000 ? last : null);
  }
  // 경계 바로 위(더 최신)의 가장 오래된 안 읽은 아티스트 메시지 — 불러온 것 전부가 새 메시지면 경계가 더 예전 쪽이라 표시 안 함
  const firstUnreadId = useMemo(() => {
    if (!readMarker) return undefined;
    let candidate: string | undefined;
    for (const message of messages) {
      if (message.createdAt <= readMarker) return candidate;
      if (message.senderType === 'ARTIST' && !message.extra) candidate = message.id;
    }
    return undefined;
  }, [messages, readMarker]);

  const rows = useMemo(() => groupAlbums(messages), [messages]);

  const listRef = useRef<FlatList<ChatItem>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seenNewestId, setSeenNewestId] = useState<string | undefined>(undefined);
  const newestId = messages[0]?.id;
  const unseen = atBottom || !seenNewestId ? 0 : Math.max(messages.findIndex((m) => m.id === seenNewestId), 0);
  // 위로 올려 읽는 중 새로 온 메시지 미리보기(2026-10-13) — 새 것 중 가장 최근 아티스트 메시지(없으면 가장 최근 것)
  const unseenPreview = unseen > 0 ? (messages.slice(0, unseen).find((m) => m.senderType === 'ARTIST') ?? messages[0]) : undefined;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const bottom = event.nativeEvent.contentOffset.y < AT_BOTTOM_PX;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (!bottom && atBottom) setSeenNewestId(newestId);
    if (bottom && seenNewestId) setSeenNewestId(undefined);
  };

  // 채팅방 안 검색(2026-09-29, 카톡처럼 방 안에서) — 위/아래 화살표로 결과(최신 → 오래된 순)를 옮겨 다니며 그 메시지로 이동
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchText.trim());
      setMatchIndex(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);
  const search = useChatSearch(searchOpen ? actorId : undefined, searchQuery);
  const hits = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const activeMatchId = hits[matchIndex]?.id;
  const goOlderMatch = () => {
    if (matchIndex + 1 < hits.length) setMatchIndex(matchIndex + 1);
    // 불러온 결과의 끝이면 다음 결과 묶음을 받은 뒤 넘어감
    if (matchIndex + 2 >= hits.length && search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText('');
    setHighlightId(null);
  };

  // 알림(focus)이나 검색 결과로 들어온 메시지로 이동해 강조 — 아직 안 불러온 예전 메시지면 찾을 때까지 이전 대화를 더
  // 불러옴(최대 MAX_FOCUS_PAGES). 이미 한 번 처리한 대상은 폴링으로 목록이 바뀌어도 다시 안 함
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const handledFocus = useRef<string | null>(null);
  const focusPaging = useRef<{ target: string | null; pages: number }>({ target: null, pages: 0 });
  const target = searchOpen ? (activeMatchId ?? null) : (focus ?? null);
  useEffect(() => {
    if (!target || handledFocus.current === target) return;
    const index = rows.findIndex((row) => rowHas(row, target));
    if (index < 0) {
      const paging = focusPaging.current;
      if (paging.target !== target) focusPaging.current = { target, pages: 0 };
      if (isFetchingNextPage) return;
      if (hasNextPage && focusPaging.current.pages < MAX_FOCUS_PAGES) {
        focusPaging.current.pages += 1;
        void fetchNextPage();
      } else {
        handledFocus.current = target;
        if (searchOpen) void Promise.resolve().then(() => setNotice(t('chatSearch.notLoaded')));
      }
      return;
    }
    handledFocus.current = target;
    setHighlightId(target);
    const scroll = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }), 50);
    return () => clearTimeout(scroll);
  }, [target, rows, hasNextPage, isFetchingNextPage, fetchNextPage, searchOpen, t]);
  // 안 읽은 메시지가 화면을 넘을 만큼 많으면 처음 열 때 "여기까지 읽었어요"로(알림·검색으로 들어왔으면 그쪽이 우선)
  const handledMarker = useRef(false);
  useEffect(() => {
    if (handledMarker.current || focus || !firstUnreadId) return;
    handledMarker.current = true;
    const index = rows.findIndex((row) => rowHas(row, firstUnreadId));
    if (index < 4) return;
    const scroll = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }), 50);
    return () => clearTimeout(scroll);
  }, [firstUnreadId, focus, rows]);
  // 알림으로 온 강조는 잠깐만(검색 중엔 지금 결과를 계속 강조)
  useEffect(() => {
    if (!highlightId || searchOpen) return;
    const clear = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(clear);
  }, [highlightId, searchOpen]);

  useEffect(() => {
    navigation.setOptions({
      headerShadowVisible: false,
      headerStyle: { backgroundColor: theme.background },
      // 닉네임(크게) + 공식 이름(작게, 닉네임과 다를 때만) — 사진은 넣지 않음(카톡처럼). 누르면 대화방 프로필 카드
      headerTitleAlign: 'center',
      headerTitle: () =>
        actor ? (
          <Pressable onPress={() => openProfile()} style={styles.headerTitle} accessibilityRole="button" accessibilityHint={t('chatProfile.open')}>
            <ThemedText type="headline" numberOfLines={1} style={styles.headerName}>
              {actor.chatDisplayName}
            </ThemedText>
            {actor.legalName !== actor.chatDisplayName ? (
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.headerName}>
                {actor.legalName}
              </ThemedText>
            ) : null}
          </Pressable>
        ) : null,
      // 구독 중일 때만: 검색 + ⋯(사진·영상 모아보기, 채팅방별 알림, 구독 관리)
      headerRight: subscription
        ? () => (
            <View style={styles.headerActions}>
              <IconButton icon={Search} label={t('chatSearch.open')} onPress={() => setSearchOpen(true)} />
              <IconButton icon={Ellipsis} label={t('chat.more')} onPress={() => setMoreOpen((open) => !open)} />
            </View>
          )
        : undefined,
    });
  }, [actor, navigation, openProfile, subscription, t, theme]);

  // 알림 안내 등 짧은 문구는 잠깐 보였다 사라짐
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const saveVoice = (message: ChatMessage) => {
    if (!message.mediaUrl) return;
    saveMedia({ id: message.id, url: message.mediaUrl, mediaType: 'AUDIO' })
      .then((result) => setNotice(result === 'saved' ? t('media.saved') : null))
      .catch(() => setNotice(t('media.saveFailed')));
  };

  // 실패하면 쓴 글을 되돌려 놓고 이유를 보여줌(금칙어·차단·답장 한도 등).
  // 첫 답장 전엔 메시지 이용 규칙 동의를 한 번 받음(버블 방식, 2026-10-12) — 취소하면 쓴 글은 그대로 둠
  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    if (onboarding?.needsReplyRules) {
      const agreed = await confirm(t('replyRules.title'), t('replyRules.body'), t('replyRules.agree'), t('common.cancel'), false);
      if (!agreed) return;
      try {
        await acceptReplyRules.mutateAsync();
      } catch {
        setNotice(t('replyRules.failed'));
        return;
      }
    }
    setDraft('');
    setNotice(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    sendReply.mutate(body, {
      onError: (err) => {
        setDraft((current) => current || body);
        setNotice(err instanceof ApiError ? err.message : t('chat.sendFailed'));
      },
    });
  };

  // 음성 메시지 이어 듣기 — 각 음성 다음(더 최신)에 오는 음성(카톡처럼 하나 끝나면 다음 것 재생)
  const nextVoice = useMemo(() => {
    const map = new Map<string, string>();
    let newer: string | undefined;
    for (const message of messages) {
      if (message.mediaType !== 'AUDIO') continue;
      if (newer) map.set(message.id, newer);
      newer = message.id;
    }
    return map;
  }, [messages]);

  const copyText = (message: ChatMessage) => {
    setMenuFor(null);
    if (!message.body) return;
    Clipboard.setStringAsync(message.body)
      .then(() => setNotice(t('chat.copied')))
      .catch(() => setNotice(t('chat.copyFailed')));
  };

  // 내 답장 회수(2026-10-14 사용자 결정) — 모두의 화면에서 "회수된 메시지입니다"로, 하루 답장 개수는 돌아오지 않음
  const retract = async (message: ChatMessage) => {
    setMenuFor(null);
    if (!(await confirm(t('retract.title'), t('retract.fanBody'), t('retract.action'), t('common.cancel')))) return;
    retractReply.mutate(message.id, { onError: (err) => setNotice(err instanceof ApiError ? err.message : t('retract.failed')) });
  };

  // 버블 방식: 팬 답장은 가장 최근 스타 메시지에 붙음 — 구독 후 스타 메시지가 아직 없으면 보내기를 막고 안내.
  // 환영·생일 메시지는 화면에서 만든 것이라 답장 대상이 아님(2026-10-15 — 예전엔 환영 메시지도 세서 "답장 3개까지" 안내가 잘못 뜸)
  const canReply = messages.some((message) => message.senderType === 'ARTIST' && !message.extra);
  const { data: quota } = useReplyQuota(actorId, canReply);
  const replyBlocked = !!quota?.blocked;
  const outOfReplies = !!quota && quota.remaining === 0;

  // isPending: 구독 목록을 기다리느라 아직 안 불러온 동안도 로딩으로
  const body = isPending && !isError ? (
    <ActivityIndicator style={styles.loading} color={theme.tint} />
  ) : notSubscribed ? (
    // 403 = 구독이 없음(해지·만료) — 다시 구독하는 길을 보여줌
    <EmptyState
      icon={Lock}
      title={t('chat.notSubscribedTitle')}
      body={t('chat.notSubscribed', { name: actor?.chatDisplayName ?? '' })}
      action={<Button title={t('chat.resubscribe')} onPress={() => router.replace({ pathname: '/actor/[id]', params: { id: actorId } })} />}
    />
  ) : isError ? (
    <EmptyState
      icon={CloudOff}
      title={t('chat.loadFailed')}
      action={<Button title={t('discover.retry')} variant="secondary" onPress={() => void refetch()} />}
    />
  ) : (
    <View style={styles.listArea}>
      <FlatList
        ref={listRef}
        inverted
        data={rows}
        keyExtractor={(item) => (item.album ? `album-${item.album[0].id}` : item.id)}
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={100}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: AT_BOTTOM_PX }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }), 100);
        }}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={theme.tint} style={styles.pageLoading} /> : null}
        ListEmptyComponent={
          <View style={styles.flip}>
            <EmptyState icon={MessageCircleHeart} title={t('chat.waitingTitle')} body={t('chat.waitingFirst', { name: actor?.chatDisplayName ?? '' })} />
          </View>
        }
        renderItem={({ item, index }) => {
          // 뒤집힌 목록: index-1이 더 최신, index+1이 더 오래된 메시지
          const newer = rows[index - 1];
          const older = rows[index + 1];
          // 커플방은 보낸 배우가 바뀌어도 묶음을 나눔(누가 보냈는지 보이게)
          const sameSender = (a: ChatItem, b: ChatItem) => !a.extra && !b.extra && a.senderType === b.senderType && (!isCouple || a.sender?.id === b.sender?.id);
          const endsGroup = !newer || !sameSender(newer, item) || !sameMinute(newer.createdAt, item.createdAt);
          const dayChanged = !older || !sameDay(older.createdAt, item.createdAt);
          const startsGroup = !older || !sameSender(older, item) || !sameMinute(item.createdAt, older.createdAt);
          return (
            <View>
              {dayChanged && <DayDivider iso={item.createdAt} />}
              {rowHas(item, firstUnreadId) && <ReadMarker label={t('chat.readMarker')} />}
              <MessageRow
                message={item}
                avatarUri={isCouple ? (item.sender?.chatProfileImageUrl ?? actor?.chatProfileImageUrl) : actor?.chatProfileImageUrl}
                actorName={isCouple ? (item.sender?.chatDisplayName ?? actor?.chatDisplayName) : actor?.chatDisplayName}
                startsGroup={startsGroup}
                endsGroup={endsGroup}
                onOpenProfile={() => openProfile(isCouple ? item.sender?.id : undefined)}
                highlighted={rowHas(item, highlightId) && (!searchOpen || rowHas(item, activeMatchId))}
                menuOpen={menuFor === item.id}
                onOpenMenu={() => setMenuFor(item.id)}
                onCloseMenu={() => setMenuFor(null)}
                onReport={() => {
                  setMenuFor(null);
                  router.push({ pathname: '/report', params: { messageId: item.id } });
                }}
                onSaveVoice={() => saveVoice(item)}
                onCopy={() => copyText(item)}
                onRetract={() => void retract(item)}
                actorId={actorId}
                nextVoiceId={nextVoice.get(item.id)}
              />
            </View>
          );
        }}
      />
      {!atBottom && !unseenPreview ? <ScrollToBottomButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} /> : null}
      {unseenPreview && (
        <Pressable
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={[styles.newPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.newMessages', { count: unseen })}>
          {unseenPreview.senderType === 'ARTIST' ? (
            <Avatar uri={isCouple ? (unseenPreview.sender?.chatProfileImageUrl ?? actor?.chatProfileImageUrl) : actor?.chatProfileImageUrl} size={28} />
          ) : null}
          <View style={styles.newPillText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {unseenPreview.senderType === 'ARTIST'
                ? (isCouple ? (unseenPreview.sender?.chatDisplayName ?? actor?.chatDisplayName) : actor?.chatDisplayName)
                : t('chat.newMessagesShort', { count: unseen })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {unseenPreview.body || t(PREVIEW_MEDIA_TEXT[unseenPreview.mediaType] ?? 'chat.newMessagesShort', { count: unseen })}
            </ThemedText>
          </View>
          {unseen > 1 ? (
            <ThemedText type="caption" style={[styles.newPillCount, { backgroundColor: theme.primary, color: theme.onPrimary }]}>
              {unseen > 99 ? '99+' : unseen}
            </ThemedText>
          ) : null}
          <Icon as={ChevronDown} size={18} themeColor="textSecondary" />
        </Pressable>
      )}
      {notice && (
        <Pressable onPress={() => setNotice(null)} style={[styles.toast, { backgroundColor: theme.primary }]}>
          <ThemedText type="small" style={{ color: theme.onPrimary, textAlign: 'center' }}>
            {notice}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  const showComposer = !isPending && !isError;
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* 토피룸 배경 사진(2026-10-14) — 아티스트·소속사가 정함 */}
      <ChatBackground uri={actor?.chatBackgroundUrl} />
      <SafeAreaView style={styles.inner} edges={['bottom']}>
        {searchOpen && (
          <View style={[styles.searchBar, { borderBottomColor: theme.border }]}>
            <View style={[styles.searchField, { backgroundColor: theme.backgroundElement }]}>
              <Icon as={Search} size={16} color={theme.textTertiary} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={t('chatSearch.placeholder')}
                placeholderTextColor={theme.textTertiary}
                style={[styles.searchInput, { color: theme.text }, fontFor(400, i18n.language)]}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={goOlderMatch}
                maxLength={50}
                accessibilityLabel={t('chatSearch.placeholder')}
              />
              {search.isFetching ? <ActivityIndicator size="small" color={theme.textTertiary} /> : null}
            </View>
            {searchQuery.length > 0 && !search.isFetching ? (
              <ThemedText type="caption" themeColor="textTertiary" style={styles.searchCount} numberOfLines={1}>
                {searchQuery.length < 2
                  ? t('chatSearch.tooShort')
                  : hits.length === 0
                    ? t('chatSearch.noResults')
                    : t(search.hasNextPage ? 'chatSearch.countMore' : 'chatSearch.count', { current: matchIndex + 1, total: hits.length })}
              </ThemedText>
            ) : null}
            <IconButton icon={ChevronUp} label={t('chatSearch.older')} onPress={goOlderMatch} disabled={matchIndex + 1 >= hits.length && !search.hasNextPage} />
            <IconButton icon={ChevronDown} label={t('chatSearch.newer')} onPress={() => setMatchIndex(Math.max(matchIndex - 1, 0))} disabled={matchIndex === 0} />
            <IconButton icon={X} label={t('chatSearch.close')} onPress={closeSearch} />
          </View>
        )}
        {body}
        {moreOpen && subscription && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMoreOpen(false)} accessibilityLabel={t('chat.closeMenu')} />
            <View style={[styles.moreMenu, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <MoreItem
                icon={Images}
                label={t('gallery.open')}
                onPress={() => {
                  setMoreOpen(false);
                  router.push({ pathname: '/media-gallery/[actorId]', params: { actorId } });
                }}
              />
              <MoreItem
                icon={subscription.notificationsMuted ? Bell : BellOff}
                label={t(subscription.notificationsMuted ? 'chat.unmute' : 'chat.mute')}
                onPress={() => {
                  setMoreOpen(false);
                  setNotice(t(subscription.notificationsMuted ? 'chat.unmuted' : 'chat.muted'));
                  setMuted.mutate(!subscription.notificationsMuted);
                }}
              />
              <MoreItem
                icon={CreditCard}
                label={t('mypage.subscriptions')}
                onPress={() => {
                  setMoreOpen(false);
                  router.push({ pathname: '/subscriptions/[actorId]', params: { actorId } });
                }}
              />
            </View>
          </>
        )}
        {/* 입력칸은 항상 보이고, 답장할 수 없을 땐(첫 메시지 전·이 메시지 답장 다 씀) 안내 + 입력·보내기만 막음(2026-10-15 사용자 요청 — 예전엔 입력칸이 사라져서 당황스러웠음) */}
        {showComposer && !searchOpen && (
          <View style={styles.composer}>
            {!canReply || outOfReplies ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.quota}>
                {!canReply ? t('chat.replyAfterFirst') : replyBlocked ? t('chat.replyBlocked') : t('chat.noRepliesLeft', { limit: quota?.limit })}
              </ThemedText>
            ) : quota ? (
              <ThemedText type="caption" themeColor="textTertiary" style={styles.quota}>
                {t('chat.repliesLeft', { count: quota.remaining })}
              </ThemedText>
            ) : null}
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                editable={canReply && !outOfReplies}
                placeholder={t('chat.replyPlaceholder')}
                placeholderTextColor={theme.textTertiary}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, !canReply || outOfReplies ? styles.inputDisabled : null, fontFor(400, i18n.language)]}
                multiline
                // 웹 textarea가 기본 두 줄 높이로 커지지 않게
                numberOfLines={1}
                maxLength={1000}
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={sendReply.isPending || !draft.trim() || !canReply || outOfReplies}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                style={[styles.sendButton, { backgroundColor: draft.trim() && canReply && !outOfReplies ? theme.tint : theme.backgroundElement }]}>
                {sendReply.isPending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Icon as={ArrowUp} size={20} strokeWidth={2.25} color={draft.trim() && canReply && !outOfReplies ? '#ffffff' : theme.textTertiary} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function MoreItem({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.moreItem} accessibilityRole="menuitem">
      <Icon as={icon} size={18} color={theme.text} />
      <ThemedText type="smallMedium">{label}</ThemedText>
    </Pressable>
  );
}

// 새 메시지 미리보기에서 글이 없는 메시지(사진·음성·영상)의 대신 문구 — 인박스와 같은 문구
const PREVIEW_MEDIA_TEXT: Partial<Record<string, string>> = { PHOTO: 'inbox.sentPhoto', AUDIO: 'inbox.sentVoice', VIDEO: 'inbox.sentVideo' };

function ReadMarker({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.readMarker} accessibilityRole="text">
      <View style={[styles.readMarkerLine, { backgroundColor: theme.tint }]} />
      <ThemedText type="caption" style={{ color: theme.tint }}>
        {label}
      </ThemedText>
      <View style={[styles.readMarkerLine, { backgroundColor: theme.tint }]} />
    </View>
  );
}


/** 연달아 온 사진·영상 격자 — 칸을 누르면 전체 화면(그 방의 사진·영상을 좌우로 넘겨 봄) */
function MessageRow({
  message,
  avatarUri,
  actorName,
  startsGroup,
  endsGroup,
  onOpenProfile,
  highlighted,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onReport,
  onSaveVoice,
  onCopy,
  onRetract,
  actorId,
  nextVoiceId,
}: {
  message: ChatItem;
  avatarUri?: string | null;
  actorName?: string;
  startsGroup: boolean;
  endsGroup: boolean;
  onOpenProfile: () => void;
  highlighted: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onReport: () => void;
  onSaveVoice: () => void;
  onCopy: () => void;
  onRetract: () => void;
  actorId: string;
  nextVoiceId?: string;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isArtist = message.senderType === 'ARTIST';
  const isMedia = message.mediaType === 'PHOTO' || message.mediaType === 'VIDEO';
  const time = new Date(message.createdAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  // 길게 누르면: 글이 있으면 복사(카톡처럼, 내 답장도), 스타 메시지면 신고, 내 답장이면 회수(2026-10-14). 회수된 메시지는 메뉴 없음
  const canReport = isArtist && !message.extra && !message.retracted;
  const canRetract = !isArtist && !message.extra && !message.retracted;
  const hasMenu = !message.retracted && (canReport || canRetract || !!message.body);
  // 아티스트가 팬 답장을 인용한 메시지(2026-10-15 사용자 요청): 인용은 아티스트 말풍선 위에 따로 선 말풍선으로, "번역 보기" 하나로 둘 다 번역
  const quote = !message.retracted && !message.album ? message.replyTo : null;
  // null = 아직 누르지 않음 — 자동 번역 설정(2026-10-16)을 따름
  const autoTranslate = useAutoTranslate();
  const [translateChoice, setTranslateOpen] = useState<boolean | null>(null);
  const translateOpen = translateChoice ?? autoTranslate;
  const quoteTranslatable = !!quote && !quote.hidden && !!quote.body && needsTranslation(quote.body, i18n.language);
  // 긴 메시지 전체보기 화면 위쪽(2026-10-19)
  const sender = { name: actorName ?? '', avatar: avatarUri, createdAt: message.createdAt };
  const senderMeta = { senderName: actorName, senderAvatar: avatarUri, createdAt: message.createdAt };

  const bubble = (
    <Pressable
      onLongPress={hasMenu ? onOpenMenu : undefined}
      delayLongPress={350}
      accessibilityHint={hasMenu ? t('chat.messageActions') : undefined}
      accessibilityActions={[
        ...(message.body ? [{ name: 'copy', label: t('chat.copy') }] : []),
        ...(canReport ? [{ name: 'report', label: t('chat.report') }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'report') onReport();
        if (event.nativeEvent.actionName === 'copy') onCopy();
      }}
      style={[styles.bubbleWrap, highlighted && { borderRadius: Radius.lg + 2, borderWidth: 2, borderColor: theme.tint }]}>
      {message.retracted ? (
        <View style={[styles.bubble, styles.retracted, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textTertiary">
            {t('retract.placeholder')}
          </ThemedText>
        </View>
      ) : message.album ? (
        <AlbumGrid items={message.album} actorId={actorId} onLongPressItem={hasMenu ? onOpenMenu : undefined} />
      ) : isMedia ? (
        <View style={styles.mediaGroup}>
          <MediaTile
            id={message.id}
            url={message.mediaUrl}
            mediaType={message.mediaType as 'PHOTO' | 'VIDEO'}
            durationMs={message.mediaDurationMs}
            thumbnailUrl={message.thumbnailUrl}
            thumbhash={message.thumbhash}
            actorId={actorId}
            onLongPress={hasMenu ? onOpenMenu : undefined}
          />
          {message.body ? (
            <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
              <TranslatableText actorId={actorId} messageId={message.id} text={message.body} open={translateOpen} autoOpened={translateChoice === null} onOpenChange={setTranslateOpen} alsoTranslatable={quoteTranslatable} sender={sender} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.bubble, { backgroundColor: isArtist ? theme.backgroundElement : theme.tintSoft }]}>
          {message.mediaType === 'AUDIO' ? (
            <VoiceMessage
              id={message.id}
              url={message.mediaUrl}
              durationMs={message.mediaDurationMs}
              waveform={message.waveform}
              tone="dark"
              onSave={onSaveVoice}
              nextId={nextVoiceId}
            />
          ) : null}
          {/* 스타 메시지는 다른 언어면 "번역 보기"(내 답장은 번역 안 함) */}
          {message.extra ? (
            <ThemedText type="captionBold" style={{ color: theme.tint }}>
              {message.extra === 'welcome' ? t('chat.welcomeLabel') : t('chat.birthdayLabel')}
            </ThemedText>
          ) : null}
          {message.body ? message.extra === 'welcome' ? <TranslatableText actorId={actorId} messageId={message.id} text={message.body} welcome sender={sender} /> : message.extra ? <MessageText message={{ text: message.body, ...senderMeta }} /> : isArtist ? <TranslatableText actorId={actorId} messageId={message.id} text={message.body} open={translateOpen} autoOpened={translateChoice === null} onOpenChange={setTranslateOpen} alsoTranslatable={quoteTranslatable} sender={sender} /> : <MessageText message={{ text: message.body, createdAt: message.createdAt }} /> : null}
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.row, !endsGroup && styles.rowTight]}>
      <View style={[styles.line, isArtist ? styles.lineLeft : styles.lineRight]}>
        {isArtist && (
          <View style={styles.avatarSlot}>
            {startsGroup ? (
              <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={t('chatProfile.open')}>
                <Avatar uri={avatarUri} size={36} />
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={[styles.column, isArtist ? styles.columnLeft : styles.columnRight]}>
          {isArtist && startsGroup ? (
            <ThemedText type="captionBold" themeColor="textSecondary" style={styles.senderLabel} numberOfLines={1}>
              {actorName}
            </ThemedText>
          ) : null}
          {quote ? (
            <View style={styles.quoteLine}>
              <QuoteBlock quote={quote} tone="dark" mine={message.quotedMe} artistName={actorName ?? ''} standalone translate={{ actorId, open: translateOpen }} />
            </View>
          ) : null}
          {/* 시간은 말풍선 옆 아래(카톡처럼 — 받은 메시지는 오른쪽, 내 답장은 왼쪽, 2026-10-12 사용자 요청. 예전엔 말풍선 밑) */}
          <View style={[styles.bubbleLine, isArtist ? styles.bubbleLineLeft : styles.bubbleLineRight]}>
            {bubble}
            {endsGroup && (
              <ThemedText type="caption" themeColor="textTertiary" style={styles.time}>
                {time}
              </ThemedText>
            )}
          </View>
          {menuOpen && (
            <MessageMenu
              onClose={onCloseMenu}
              align={isArtist ? 'left' : 'right'}
              actions={[
                ...(message.body ? [{ key: 'copy', label: t('chat.copy'), icon: Copy, onPress: onCopy }] : []),
                ...(canRetract ? [{ key: 'retract', label: t('retract.action'), icon: Undo2, danger: true, onPress: onRetract }] : []),
                // 문제 신고는 맨 뒤에 흐리게(2026-10-15 — 앱 심사상 꼭 있어야 하지만 눈에 띌 필요는 없음)
                ...(canReport ? [{ key: 'report', label: t('chat.report'), icon: Flag, muted: true, onPress: onReport }] : []),
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerTitle: { maxWidth: 220, alignItems: 'center' },
  headerName: { textAlign: 'center' },
  moreMenu: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.three,
    minWidth: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.one,
  },
  moreItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  searchField: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, minHeight: 40 },
  searchCount: { flexShrink: 0, marginLeft: Spacing.one },
  searchInput: { flex: 1, minWidth: 0, width: '100%', fontSize: 15, paddingVertical: Spacing.two, outlineStyle: 'none' } as object,
  listArea: { flex: 1 },
  // 뒤집힌 목록이라 flex-end = 화면 위쪽 — 메시지가 적으면(환영 메시지만 있을 때 등) 위에서부터 보이고(2026-10-15), 화면을 넘으면 맨 아래 최신부터
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, flexGrow: 1, justifyContent: 'flex-end' },
  // 뒤집힌 목록 안의 빈 화면은 위아래가 뒤집혀 보이지 않게
  flip: { transform: [{ scaleY: -1 }] },
  pageLoading: { marginVertical: Spacing.three },
  loading: { marginTop: Spacing.six },
  row: { marginBottom: Spacing.three },
  rowTight: { marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  lineLeft: { justifyContent: 'flex-start' },
  lineRight: { justifyContent: 'flex-end' },
  avatarSlot: { width: 36 },
  column: { maxWidth: '86%', gap: 4 },
  quoteLine: { maxWidth: '100%' },
  columnLeft: { alignItems: 'flex-start' },
  columnRight: { alignItems: 'flex-end' },
  bubbleWrap: { maxWidth: '100%', flexShrink: 1 },
  bubbleLine: { alignItems: 'flex-end', gap: 4, maxWidth: '100%' },
  bubbleLineLeft: { flexDirection: 'row' },
  bubbleLineRight: { flexDirection: 'row-reverse' },
  bubble: { borderRadius: Radius.lg + 2, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  mediaGroup: { gap: 4 },
  time: { flexShrink: 0, paddingBottom: 2 },
  senderLabel: { paddingHorizontal: 4 },
  retracted: { borderWidth: StyleSheet.hairlineWidth },
  newPill: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  newPillText: { flex: 1, minWidth: 0 },
  newPillCount: { borderRadius: Radius.pill, paddingHorizontal: 6, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  readMarker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.three },
  readMarkerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  toast: {
    position: 'absolute',
    top: Spacing.three,
    alignSelf: 'center',
    maxWidth: '86%',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputDisabled: { opacity: 0.5 },
  composer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two, gap: 4 },
  quota: { paddingHorizontal: Spacing.two },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    outlineStyle: 'none',
  } as object,
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
