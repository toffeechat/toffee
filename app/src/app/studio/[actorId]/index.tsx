import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { ArrowUp, AtSign, Camera, Copy, CornerUpLeft, ImagePlus, Mic, MoreHorizontal, Send, Square, Undo2, UserRound, Video, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { MediaTile } from '@/components/media-tile';
import { ReplyTicker } from '@/components/reply-ticker';
import { QuoteBlock } from '@/components/quote-block';
import { VoiceMessage } from '@/components/voice-message';
import { ChatBackground } from '@/components/chat-background';
import { DayDivider, sameDay } from '@/components/day-divider';
import { AlbumGrid } from '@/components/album-grid';
import { collapseRetracted, groupAlbumRows, rowHas } from '@/utils/chat-album';
import { MessageMenu } from '@/components/message-menu';
import { copyText } from '@/lib/copy-text';
import { GreetingsForm, greetingsReady, useGreetings } from '@/components/greetings-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { useActor } from '@/hooks/use-actors';
import { useDeleteBroadcast, useStudioMessages, useStudioSend, type Attachment, type StudioMessage } from '@/hooks/use-studio';
import { PLAYBACK_AUDIO_MODE } from '@/lib/audio-mode';
import { ApiError } from '@/lib/api-client';
import { confirm } from '@/lib/confirm';
import { UploadCancelledError } from '@/lib/upload-media';
import { useTheme } from '@/hooks/use-theme';
import { fontFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { dbToLevel, resample } from '@/lib/waveform';
import { NAME_TOKEN, showNameToken } from '@/utils/name-token';
import { handleWebEnterKey } from '@/utils/enter-to-send';

// 음량 측정(metering)을 켜서 녹음 중 음파 모양을 모음 — 보낼 때 48칸으로 줄여서 같이 보냄
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const WAVEFORM_BARS = 48;

// 앨범/카메라에서 고른 파일 → 첨부물. iOS는 HEIC 대신 호환 형식(JPEG)으로 받아서 안드로이드·웹 팬도 볼 수 있게.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images', 'videos'],
  quality: 0.8,
  videoMaxDuration: 300,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

// 여러 장 보내기(2026-10-13) — 앨범에서 최대 10개까지 고른 순서대로, 한 장씩 메시지로 보냄(팬 화면은 연달아 온 사진을 격자로 묶음)
const MAX_BATCH = 10;
const sameMinute = (a: string, b: string) => Math.floor(new Date(a).getTime() / 60_000) === Math.floor(new Date(b).getTime() / 60_000);

function toAttachments(result: ImagePicker.ImagePickerResult): Attachment[] {
  if (result.canceled) return [];
  return result.assets.slice(0, MAX_BATCH).map((asset) => ({
    mediaType: asset.type === 'video' ? 'VIDEO' : 'PHOTO',
    uri: asset.uri,
    contentType: asset.mimeType,
    durationMs: asset.type === 'video' && asset.duration ? Math.round(asset.duration) : undefined,
  }));
}

// senderName: 커플방이면 누가 보낸 메시지인지(두 멤버가 같은 화면을 봄) — 1인 방은 null
// 2026-10-14 사용자 피드백: 시간은 마지막 말풍선 바로 옆(사진+글이면 예전엔 사진 왼쪽 끝에 맞춰져 떨어져 보였음), 날짜는 구분선으로,
// 휴지통 대신 말풍선을 길게 누르면 복사 · 회수(웹은 시간 아래 ⋯로도)
function MyMessage({
  message,
  actorId,
  onOpenReplies,
  onRetract,
  onQuote,
  senderName,
  isLatest,
  menuFor,
  onOpenMenu,
  onCloseMenu,
}: {
  /** 연달아 보낸 사진·영상이면 album(시간순) — 줄의 나머지 값(답장 수 등)은 가장 최근 것(2026-10-15, 팬 화면과 같은 격자) */
  message: StudioMessage & { album?: StudioMessage[] };
  actorId: string;
  isLatest?: boolean;
  onOpenReplies: () => void;
  /** 회수할 메시지 id들 — 사진 격자면 묶음 전체 */
  onRetract: (ids: string[]) => void;
  /** CP방에서 상대 아티스트 메시지에 답장(인용) */
  onQuote?: () => void;
  senderName?: string | null;
  /** 메뉴가 열린 메시지 id(격자 안 한 장일 수도) */
  menuFor: string | null;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
}) {
  const menuOpen = !!menuFor && rowHas(message, menuFor);
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const hiddenByAdmin = !!message.deletedAt && message.deletedByAdmin;
  // 소속사가 대신 회수한 메시지(2026-10-12) — 아티스트도 알 수 있게 이유와 함께 남김
  const removedByAgency = !!message.deletedAt && !message.deletedByAdmin && !!message.deletedByStaffId;
  const removed = hiddenByAdmin || removedByAgency;
  // 내가 회수한 메시지(2026-10-14) — 팬 화면과 같게 자리만 "회수한 메시지예요"
  const retracted = !!message.deletedAt && !removed;
  // 최근 메시지엔 서버가 recentReplies를 줌, 오래된 메시지는 숫자만. 답장이 없을 때 "팬 답장을 기다리는 중…"은 가장 최근 메시지에만
  // (2026-10-12 실기기: 최근 10개 메시지마다 붙어 있어 어수선했음) — 나머지는 "답장 없음" 링크로
  const hasPreview = !!message.recentReplies && !message.deletedAt && (message.recentReplies.length > 0 || !!isLatest);
  const time = new Date(message.createdAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  const isMedia = message.mediaType === 'PHOTO' || message.mediaType === 'VIDEO';
  const hasMenu = !message.deletedAt;
  const bodyText = message.body ? showNameToken(message.body, t('studio.fanNickname')) : null;

  // 시간(+ 커플방이면 보낸 사람) — 마지막 말풍선 옆 아래
  const side = (
    <View style={styles.sideRow}>
      {/* 웹(PC)은 마우스로 길게 누르기가 어색해서 시간 옆 ⋯로도 */}
      {Platform.OS === 'web' && hasMenu ? (
        <IconButton icon={MoreHorizontal} size={15} label={t('chat.messageActions')} color={theme.textTertiary} onPress={() => onOpenMenu(message.id)} style={styles.metaButton} />
      ) : null}
      <View style={styles.sideTime}>
        {senderName ? (
          <ThemedText type="caption" themeColor="textTertiary" style={styles.sideTimeText}>
            {senderName}
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textTertiary" style={styles.sideTimeText}>
          {time}
        </ThemedText>
      </View>
    </View>
  );
  const textBubble =
    !isMedia || message.body ? (
      <View style={[styles.bubble, { backgroundColor: theme.tintSoft }]}>
        {message.mediaType === 'AUDIO' ? (
          <VoiceMessage id={message.id} url={message.mediaUrl} durationMs={message.mediaDurationMs} waveform={message.waveform} tone="dark" />
        ) : null}
        {bodyText ? <ThemedText>{bodyText}</ThemedText> : null}
      </View>
    ) : null;

  return (
    <View style={styles.messageRow}>
      {removed && (
        <ThemedText type="small" themeColor="danger">
          {t(hiddenByAdmin ? 'studio.hiddenByAdmin' : 'console.deletedByAgency')}
        </ThemedText>
      )}
      {retracted ? (
        <View style={styles.bubbleLine}>
          <View style={[styles.bubble, styles.retracted, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textTertiary">
              {t('retract.mine')}
            </ThemedText>
          </View>
          {side}
        </View>
      ) : (
        <Pressable onLongPress={hasMenu ? () => onOpenMenu(message.id) : undefined} delayLongPress={350} accessibilityHint={hasMenu ? t('chat.messageActions') : undefined} style={[styles.column, removed && styles.hidden]}>
          {/* 인용한 팬 답장은 내 말풍선 위에 따로 선 말풍선으로(2026-10-15 사용자 요청 — 팬 화면과 같게) */}
          {message.replyTo && !message.album ? <QuoteBlock quote={message.replyTo} tone="dark" standalone /> : null}
          {message.album ? (
            <View style={styles.bubbleLine}>
              <AlbumGrid items={message.album} actorId={actorId} onLongPressItem={onOpenMenu} />
              {side}
            </View>
          ) : isMedia ? (
            <View style={styles.bubbleLine}>
              <View style={styles.mediaColumn}>
                {/* 사진이 누르기를 먼저 받아서 길게 누르기도 사진에 직접(2026-10-15 — 앱에서 사진 회수가 안 되던 문제), actorId로 전체 화면에서 좌우 넘기기 */}
                <MediaTile
                  id={message.id}
                  url={message.mediaUrl}
                  mediaType={message.mediaType as 'PHOTO' | 'VIDEO'}
                  durationMs={message.mediaDurationMs}
                  thumbnailUrl={message.thumbnailUrl}
                  thumbhash={message.thumbhash}
                  actorId={actorId}
                  onLongPress={hasMenu ? () => onOpenMenu(message.id) : undefined}
                />
              </View>
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
      )}
      {menuOpen && (
        <View style={styles.menuWrap}>
          <MessageMenu
            onClose={onCloseMenu}
            align="right"
            actions={[
              ...(message.body
                ? [{ key: 'copy', label: t('chat.copy'), icon: Copy, onPress: () => (onCloseMenu(), copyText(bodyText)) }]
                : []),
              // CP방 상대 아티스트 메시지엔 회수 대신 답장(2026-10-15 — 두 아티스트가 서로 답장, 팬 화면엔 인용 말풍선 두 개로)
              ...(onQuote && message.mine === false
                ? [{ key: 'quote', label: t('quote.action'), icon: CornerUpLeft, accent: true, onPress: () => (onCloseMenu(), onQuote()) }]
                : [{ key: 'retract', label: t('retract.action'), icon: Undo2, danger: true, onPress: () => (onCloseMenu(), onRetract(message.album ? message.album.map((item) => item.id) : [message.id])) }]),
            ]}
          />
        </View>
      )}
      {!hasPreview && !message.deletedAt && (
        <Pressable onPress={onOpenReplies} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            {message.replyCount > 0 ? `${t('studio.replies', { count: message.replyCount })} ›` : t('studio.noReplies')}
          </ThemedText>
        </Pressable>
      )}
      {/* 최근 메시지는 팬 답장이 온 순서대로 한 줄씩 넘어가며 보임(버블·위버스 방식) */}
      {hasPreview && <ReplyTicker replies={message.recentReplies ?? []} count={message.replyCount} onPress={onOpenReplies} />}
    </View>
  );
}

/**
 * 스타(배우 본인)의 스튜디오 — 팬 채팅방(2A)과 같은 말투의 화면: 내가 보낸 메시지가 오른쪽 Periwinkle 말풍선으로 쌓이고,
 * 최근 메시지 아래엔 팬 답장 줄. 아래 입력창에서 글·사진/영상·음성을 보내고, "팬 이름 넣기"로 받는 팬마다 닉네임으로 부름.
 * 큰 영상은 올라가는 정도(%)와 취소 버튼을 보여줌(예전엔 돌기만 해서 멈춘 것처럼 보였음).
 */
export default function StudioChannelScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  // 팬 답장 화면에서 "답장하기"를 누르면 인용할 팬 메시지 정보를 들고 이 화면으로 옴
  const { actorId, quoteId, quoteNickname, quoteBody } = useLocalSearchParams<{
    actorId: string;
    quoteId?: string;
    quoteNickname?: string;
    quoteBody?: string;
  }>();
  const clearQuote = () => router.setParams({ quoteId: undefined, quoteNickname: undefined, quoteBody: undefined });
  const { data: actor } = useActor(actorId);
  const { data: greetings } = useGreetings(actorId);
  const { data: messages, isLoading } = useStudioMessages(actorId);
  const send = useStudioSend(actorId);
  const deleteBroadcast = useDeleteBroadcast(actorId);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const levels = useRef<number[]>([]);
  const uploadAbort = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState('');
  // 보낼 첨부물 — 음성·카메라는 1개, 앨범은 여러 개(MAX_BATCH)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachment = attachments[0] ?? null;
  const setAttachment = (next: Attachment | null) => setAttachments(next ? [next] : []);
  // 여러 개 보내는 중이면 지금 몇 번째인지(1부터)
  const [batchStep, setBatchStep] = useState<{ index: number; total: number } | null>(null);
  // 음성 녹음 패널(2026-10-12 실기기 피드백: 마이크를 누르자마자 녹음되지 말고 "녹음 → 다시 듣기·다시 녹음·취소 → 보내기")
  const [voicePanel, setVoicePanel] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (recorderState.isRecording) levels.current.push(dbToLevel(recorderState.metering));
  }, [recorderState.isRecording, recorderState.metering, recorderState.durationMillis]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // 스토리 올리기는 후순위(3차)로 미뤄서 이 화면엔 없음 — 서버 API는 남아 있음(STATUS.md)
  useEffect(() => {
    // 헤더는 팬 토피룸과 같은 모양(2026-10-14 사용자 요청 "팬·아티스트 대화창 UI 통일") — 이름 가운데, 사진 없음
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerTitle: () =>
        actor ? (
          <View style={styles.headerTitle}>
            <ThemedText type="headline" numberOfLines={1} style={styles.headerName}>
              {actor.chatDisplayName}
            </ThemedText>
            {actor.kind === 'COUPLE' ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {t('couple.roomLabel')}
              </ThemedText>
            ) : null}
          </View>
        ) : null,
      headerRight: () => <IconButton icon={UserRound} label={t('studio.profileButton')} onPress={() => router.push(`/studio/${actorId}/profile`)} />,
    });
  }, [actor, navigation, router, actorId, t]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  // 사진 묶음은 통째로 회수(2026-10-15 사용자 결정 — 카톡·버블처럼 같이 보낸 사진은 한 메시지처럼). 메시지는 한 장씩 저장돼 있어서 하나씩 회수
  const retractMessages = async (messageIds: string[]) => {
    const album = messageIds.length > 1;
    const ok = await confirm(
      album ? t('retract.albumTitle', { count: messageIds.length }) : t('retract.title'),
      t('retract.artistBody'),
      t('retract.action'),
      t('common.cancel'),
    );
    if (!ok) return;
    try {
      for (const id of messageIds) await deleteBroadcast.mutateAsync(id);
    } catch {
      setNotice({ text: t('retract.failed'), error: true });
    }
  };

  const pickFromLibrary = async () => {
    const picked = toAttachments(
      await ImagePicker.launchImageLibraryAsync({ ...PICKER_OPTIONS, allowsMultipleSelection: true, selectionLimit: MAX_BATCH, orderedSelection: true }),
    );
    if (picked.length) {
      setVoicePanel(false);
      setAttachments(picked);
    }
  };

  const takeWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setNotice({ text: t('studio.permissionDenied'), error: true });
      return;
    }
    const [picked] = toAttachments(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    if (picked) {
      setVoicePanel(false);
      setAttachment(picked);
    }
  };

  const closeVoicePanel = () => {
    setVoicePanel(false);
    if (attachment?.mediaType === 'AUDIO') setAttachment(null);
  };

  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      const durationMs = recorderState.durationMillis;
      await recorder.stop();
      // 녹음이 끝나면 듣기 모드(무음 모드·백그라운드 재생)로 되돌림
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      if (recorder.uri) {
        const waveform = resample(levels.current, WAVEFORM_BARS).map((level) => Math.round(level * 100) / 100);
        setAttachment({ mediaType: 'AUDIO', uri: recorder.uri, durationMs, waveform });
      }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice({ text: t('studio.permissionDenied'), error: true });
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    levels.current = [];
    recorder.record();
    setAttachment(null);
  };

  // 여러 개: 사진·영상을 고른 순서대로 하나씩 보내고(앞쪽은 푸시 없음, 마지막 사진·영상이 "N개를 보냈어요" 알림 한 건), 글이 있으면 맨 뒤에
  // 글 메시지로 따로(그 글이 알림). 중간에 실패하면 거기서 멈추고 못 보낸 것만 남겨 둠
  const sendBatch = async (body: string) => {
    const queue = [...attachments];
    const total = queue.length;
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      for (let index = 0; index < total; index += 1) {
        setBatchStep({ index: index + 1, total });
        setProgress(0);
        const last = index === total - 1;
        await send.mutateAsync({
          body: '',
          attachment: queue[index],
          // 인용 답장은 글이 있으면 글에, 없으면 첫 사진에
          replyToMessageId: !body && index === 0 ? quoteId : undefined,
          silent: !last || !!body,
          batchCount: last && !body ? total : undefined,
          onProgress: setProgress,
          signal: controller.signal,
        });
        setAttachments(queue.slice(index + 1));
      }
      if (body) await send.mutateAsync({ body, attachment: null, replyToMessageId: quoteId });
      setDraft('');
      if (quoteId) clearQuote();
    } catch (error) {
      setNotice(
        error instanceof UploadCancelledError
          ? { text: t('studio.uploadCancelled'), error: false }
          : { text: error instanceof ApiError && error.message ? error.message : t('studio.sendFailed'), error: true },
      );
    } finally {
      setProgress(null);
      setBatchStep(null);
      uploadAbort.current = null;
    }
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body && !attachment) return;
    if (attachments.length > 1) {
      setNotice(null);
      void sendBatch(body);
      return;
    }
    setNotice(null);
    const controller = new AbortController();
    uploadAbort.current = controller;
    if (attachment) setProgress(0);
    send.mutate(
      { body, attachment, replyToMessageId: quoteId, onProgress: setProgress, signal: controller.signal },
      {
        onSuccess: () => {
          setDraft('');
          setAttachment(null);
          setVoicePanel(false);
          if (quoteId) clearQuote();
        },
        onError: (error) =>
          setNotice(
            error instanceof UploadCancelledError
              ? { text: t('studio.uploadCancelled'), error: false }
              : { text: error instanceof ApiError && error.message ? error.message : t('studio.sendFailed'), error: true },
          ),
        onSettled: () => {
          setProgress(null);
          uploadAbort.current = null;
        },
      },
    );
  };

  const canSend = !send.isPending && !batchStep && !recorderState.isRecording && (!!draft.trim() || !!attachment);
  // 회수한 메시지도 자리는 남김(2026-10-14) — 팬 화면처럼 "회수한 메시지예요", 운영자가 가렸거나 소속사가 회수한 건 이유와 함께
  // 연달아 보낸 글 없는 사진·영상은 팬 화면처럼 격자 한 칸으로(2026-10-15 — 예전엔 한 장씩 따로 보여서 장마다 "답장 없음"이 붙었음)
  const visible = useMemo(() => messages ?? [], [messages]);
  const rows = useMemo(
    () => collapseRetracted(groupAlbumRows(visible.map((message) => ({ ...message, retracted: !!message.deletedAt })), sameMinute), sameMinute),
    [visible],
  );

  // 환영·생일 메시지를 아직 안 썼으면 보내기 화면 대신 이것부터(2026-10-13 사용자 결정 — 서버도 비어 있으면 보내기를 거절).
  // 저장하면 같은 쿼리가 바뀌어서 바로 보내기 화면으로
  if (greetings && actor && !greetingsReady(greetings, actor.kind === 'COUPLE')) {
    return (
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.gate} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">{t('greetings.gateTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t(actor.kind === 'COUPLE' ? 'greetings.gateBodyCouple' : 'greetings.gateBody')}</ThemedText>
          <GreetingsForm actorId={actorId} couple={actor.kind === 'COUPLE'} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* 토피룸 배경 사진(2026-10-14) — 팬이 보는 것과 같게 */}
      <ChatBackground uri={actor?.chatBackgroundUrl} />
      <SafeAreaView style={styles.inner} edges={['bottom']}>
        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={theme.tint} />
        ) : (
          <FlatList
            inverted
            // 내가 지운 메시지는 안 보임(운영자가 가린 건 이유와 함께 보임)
            data={rows}
            keyExtractor={(item) => (item.album ? `album-${item.album[0].id}` : item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.flip}>
                <EmptyState icon={Send} title={t('studio.emptyTitle')} body={t('studio.empty')} />
              </View>
            }
            renderItem={({ item, index }) => {
              // 뒤집힌 목록: index+1이 더 오래된 메시지 — 날이 바뀌면 구분선
              const older = rows[index + 1];
              return (
                <View>
                  {(!older || !sameDay(older.createdAt, item.createdAt)) && <DayDivider iso={item.createdAt} />}
                  <MyMessage
                    message={item}
                    actorId={actorId}
                    isLatest={index === 0}
                    senderName={actor?.kind === 'COUPLE' ? (item.sender?.chatDisplayName ?? null) : null}
                    onOpenReplies={() => router.push(`/studio/${actorId}/replies/${item.id}`)}
                    onRetract={(ids) => void retractMessages(ids)}
                    onQuote={
                      actor?.kind === 'COUPLE' && item.mine === false && !item.deletedAt && !item.album
                        ? () =>
                            router.setParams({
                              quoteId: item.id,
                              quoteNickname: item.sender?.chatDisplayName ?? '',
                              quoteBody: (item.body ? showNameToken(item.body, t('studio.fanNickname')) : t(`studio.media.${item.mediaType}`)).slice(0, 120),
                            })
                        : undefined
                    }
                    menuFor={menuFor}
                    onOpenMenu={setMenuFor}
                    onCloseMenu={() => setMenuFor(null)}
                  />
                </View>
              );
            }}
          />
        )}

        {notice && (
          <Pressable onPress={() => setNotice(null)} style={[styles.toast, { backgroundColor: notice.error ? theme.danger : theme.primary }]}>
            <ThemedText type="small" style={{ color: notice.error ? '#ffffff' : theme.onPrimary, textAlign: 'center' }}>
              {notice.text}
            </ThemedText>
          </Pressable>
        )}

        {quoteId && (
          <View style={[styles.tray, { backgroundColor: theme.tintSoft }]}>
            <Icon as={CornerUpLeft} size={18} color={theme.tint} />
            <View style={styles.trayBody}>
              <ThemedText type="smallBold">{t('quote.replyTo', { nickname: quoteNickname ?? '' })}</ThemedText>
              {quoteBody ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {quoteBody}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" themeColor="textSecondary">
                {t('quote.publicNotice', { name: actor?.chatDisplayName ?? '' })}
              </ThemedText>
            </View>
            <IconButton icon={X} size={18} label={t('studio.cancelQuote')} onPress={clearQuote} />
          </View>
        )}

        {(attachment || recorderState.isRecording || voicePanel) && (
          <View style={[styles.tray, { backgroundColor: theme.backgroundElement }]}>
            {recorderState.isRecording ? (
              <>
                <View style={[styles.recDot, { backgroundColor: theme.danger }]} />
                <ThemedText type="smallBold" style={styles.trayBody}>
                  {t('studio.recording', { seconds: Math.floor(recorderState.durationMillis / 1000) })}
                </ThemedText>
                <Pressable onPress={() => void toggleRecording()} accessibilityRole="button" style={[styles.voiceButton, { backgroundColor: theme.danger }]}>
                  <Icon as={Square} size={14} color="#fff" fill="#fff" />
                  <ThemedText type="smallBold" style={styles.voiceButtonText}>
                    {t('studio.stopRecordingShort')}
                  </ThemedText>
                </Pressable>
              </>
            ) : voicePanel && attachment?.mediaType === 'AUDIO' && !send.isPending ? (
              <>
                {/* 녹음한 것 다시 듣기 — 보내기 전 확인 */}
                <View style={styles.trayBody}>
                  <VoiceMessage id="draft-voice" url={attachment.uri} durationMs={attachment.durationMs} waveform={attachment.waveform} tone="dark" />
                </View>
                <Pressable onPress={() => void toggleRecording()} accessibilityRole="button" style={[styles.voiceChip, { borderColor: theme.border }]}>
                  <ThemedText type="smallBold">{t('studio.reRecord')}</ThemedText>
                </Pressable>
                <IconButton icon={X} size={18} label={t('studio.removeAttachment')} onPress={closeVoicePanel} />
              </>
            ) : voicePanel && !attachment ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.trayBody}>
                  {t('studio.voiceHint')}
                </ThemedText>
                <Pressable onPress={() => void toggleRecording()} accessibilityRole="button" style={[styles.voiceButton, { backgroundColor: theme.danger }]}>
                  <Icon as={Mic} size={16} color="#fff" />
                  <ThemedText type="smallBold" style={styles.voiceButtonText}>
                    {t('studio.startRecording')}
                  </ThemedText>
                </Pressable>
                <IconButton icon={X} size={18} label={t('common.cancel')} onPress={closeVoicePanel} />
              </>
            ) : attachment ? (
              <>
                {attachments.length > 1 ? (
                  <View style={styles.thumbStack}>
                    {attachments.slice(0, 3).map((item, i) => (
                      <Image key={item.uri} source={{ uri: item.uri }} style={[styles.thumbSmall, { marginLeft: i ? -14 : 0, borderColor: theme.backgroundElement }]} contentFit="cover" />
                    ))}
                  </View>
                ) : attachment.mediaType === 'PHOTO' ? (
                  <Image source={{ uri: attachment.uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: theme.background }]}>
                    <Icon as={attachment.mediaType === 'VIDEO' ? Video : Mic} size={20} color={theme.tint} />
                  </View>
                )}
                <View style={styles.trayBody}>
                  <ThemedText type="smallMedium">
                    {batchStep
                      ? t('studio.batchSending', { index: batchStep.index, total: batchStep.total })
                      : attachments.length > 1
                        ? t('studio.attachedMany', { count: attachments.length })
                        : t(`studio.attached.${attachment.mediaType}`)}
                  </ThemedText>
                  {progress !== null ? (
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                      <View style={[styles.progressFill, { backgroundColor: theme.tint, width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  ) : null}
                  {progress !== null ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {t('studio.uploading', { percent: Math.round(progress * 100) })}
                    </ThemedText>
                  ) : null}
                </View>
                {send.isPending || batchStep ? (
                  <IconButton icon={X} size={18} label={t('studio.cancelUpload')} onPress={() => uploadAbort.current?.abort()} />
                ) : (
                  <IconButton icon={X} size={18} label={t('studio.removeAttachment')} onPress={() => setAttachments([])} />
                )}
              </>
            ) : null}
          </View>
        )}

        <View style={styles.tools}>
          <IconButton icon={ImagePlus} label={t('studio.attachLibrary')} onPress={pickFromLibrary} color={recorderState.isRecording ? theme.textTertiary : theme.text} />
          {Platform.OS !== 'web' && (
            <IconButton icon={Camera} label={t('studio.camera')} onPress={takeWithCamera} color={recorderState.isRecording ? theme.textTertiary : theme.text} />
          )}
          {/* 마이크: 바로 녹음하지 않고 녹음 패널을 엶(패널의 "녹음 시작"으로 시작) */}
          <IconButton
            icon={Mic}
            label={t('studio.record')}
            onPress={() => {
              if (recorderState.isRecording) return;
              if (attachment && attachment.mediaType !== 'AUDIO') setAttachment(null);
              setVoicePanel(true);
            }}
            color={voicePanel || recorderState.isRecording ? theme.danger : theme.text}
          />
          {/* 받는 팬마다 그 팬의 닉네임으로 바뀌는 자리 — 버블처럼 "OO야" 하고 부를 때 */}
          <Pressable
            onPress={() => setDraft((current) => `${current}${NAME_TOKEN}`)}
            accessibilityRole="button"
            accessibilityHint={t('studio.insertNameHint')}
            style={[styles.nameChip, { backgroundColor: theme.backgroundElement }]}>
            <Icon as={AtSign} size={15} color={theme.tint} />
            <ThemedText type="smallMedium">{t('studio.insertName')}</ThemedText>
          </Pressable>
        </View>
        {draft.includes(NAME_TOKEN) && (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.nameHint}>
            {t('studio.insertNameHint')}
          </ThemedText>
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('studio.inputPlaceholder')}
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }, fontFor(400, i18n.language)]}
            multiline
            numberOfLines={1}
            maxLength={1000}
            // PC 웹: Enter 보내기, Shift/Ctrl+Enter 줄바꿈(2026-10-15)
            onKeyPress={(event) => handleWebEnterKey(event, { value: draft, onChange: setDraft, onSend: () => canSend && handleSend() })}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('studio.send')}
            style={[styles.sendButton, { backgroundColor: canSend ? theme.tint : theme.backgroundElement }]}>
            {send.isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Icon as={ArrowUp} size={20} strokeWidth={2.25} color={canSend ? '#ffffff' : theme.textTertiary} />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerTitle: { maxWidth: 240, alignItems: 'center' },
  loading: { marginTop: Spacing.six },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: Spacing.three },
  flip: { transform: [{ scaleY: -1 }] },
  messageRow: { alignItems: 'flex-end', gap: 6 },
  headerName: { textAlign: 'center' },
  mediaColumn: { flexShrink: 1, alignItems: 'flex-end', gap: 4 },
  retracted: { borderWidth: StyleSheet.hairlineWidth },
  menuWrap: { alignSelf: 'flex-end' },
  voiceButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  voiceButtonText: { color: '#fff' },
  voiceChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: 6 },
  bubbleLine: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, maxWidth: '100%' },
  column: { maxWidth: '92%', alignItems: 'flex-end', gap: 4 },
  sideRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'flex-end' },
  sideTime: { flexShrink: 0, alignItems: 'flex-end', paddingBottom: 2 },
  sideTimeText: { textAlign: 'right' },
  hidden: { opacity: 0.45 },
  bubble: { borderRadius: Radius.lg + 2, paddingHorizontal: 14, paddingVertical: 10, gap: 6, flexShrink: 1 },
  metaButton: { width: 28, height: 28 },
  toast: { position: 'absolute', top: Spacing.three, alignSelf: 'center', maxWidth: '86%', borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, zIndex: 10 },
  tray: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginHorizontal: Spacing.three, marginBottom: Spacing.two, borderRadius: Radius.md, padding: Spacing.two, paddingLeft: Spacing.three },
  trayBody: { flex: 1, gap: 3 },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },
  gate: { padding: Spacing.four, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  thumbStack: { flexDirection: 'row' },
  thumbSmall: { width: 40, height: 40, borderRadius: Radius.sm, borderWidth: 2 },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two },
  nameChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: Spacing.three - 4, borderRadius: Radius.pill, marginLeft: Spacing.one },
  nameHint: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.one },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, paddingTop: Spacing.one },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: Spacing.three, paddingTop: 11, paddingBottom: 11, fontSize: 15, outlineStyle: 'none' } as object,
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
