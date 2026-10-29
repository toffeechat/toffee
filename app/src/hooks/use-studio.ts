import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useLiveInterval } from '@/lib/realtime';
import { onSessionReset } from '@/lib/session-reset';
import { UploadCancelledError, uploadMedia, type UploadMediaType, type UploadOptions } from '@/lib/upload-media';
import { createVideoThumbnail } from '@/lib/video-thumbnail';
import { thumbhashFor } from '@/lib/thumbhash';
import { PendingSends, SEND_RETRY } from '@/utils/send-retry';
import type { FanReply } from './use-console';
import type { ChatMessage } from './use-messages';

// 배우 본인 화면("스튜디오") — 내가 보낸 메시지(+메시지별 팬 답장 수), 발송

/** 스타 화면 "팬 답장 줄" 한 줄 — 서버가 최근 메시지 몇 개에만(답장이 없으면 빈 배열), 오래된 것 → 최신 순으로 줌 */
export interface ReplyPreview {
  id: string;
  nickname: string | null;
  body: string;
  createdAt: string;
}

export interface StudioMessage extends ChatMessage {
  replyCount: number;
  /** 보는 아티스트 본인이 보낸 메시지 — CP방에서 상대 메시지엔 회수 대신 "답장"(2026-10-15) */
  mine?: boolean;
  /** 최근 메시지에만 있음 — 없으면 오래된 메시지(답장 줄 없이 숫자만) */
  recentReplies?: ReplyPreview[];
}

const BROADCASTS_PAGE_SIZE = 100;

// 서버가 limit 없이는 최근 200개만 줌(2026-10-29) — 예전엔 전부 받았는데 이제 페이지로: 최신 100개부터, 위로 올리면(fetchNextPage)
// 이전 100개씩(before=마지막 id). data는 예전처럼 펼친 목록(최신순, 중복 제거)이라 쓰는 쪽은 그대로
export function useStudioMessages(actorId: string) {
  const interval = useLiveInterval(5000);
  return useInfiniteQuery({
    queryKey: ['actor-broadcasts', actorId],
    // 서버는 최신순으로 줌 — 화면은 inverted 리스트라 그대로 씀
    queryFn: ({ pageParam }) =>
      apiClient.get<StudioMessage[]>(
        `/actors/${actorId}/messages/broadcasts?limit=${BROADCASTS_PAGE_SIZE}` + (pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.length === BROADCASTS_PAGE_SIZE ? lastPage[lastPage.length - 1].id : undefined),
    select: (data) => {
      const seen = new Set<string>();
      return data.pages.flat().filter((message) => !seen.has(message.id) && seen.add(message.id));
    },
    enabled: !!actorId,
    // 팬 답장은 실시간 신호로 바로 반영, 연결이 끊겨 있을 때만 5초 폴링
    refetchInterval: interval,
  });
}

const REPLIES_PAGE_SIZE = 100;

/**
 * 스타 메시지 하나에 달린 팬 답장 — 최신 100개부터, 위로 올리면(fetchNextPage) 이전 100개씩. 서버는 최신 → 오래된 순.
 * 새 답장은 실시간 신호로 바로 채팅처럼 아래에 붙음(연결이 끊겨 있을 때만 3초 폴링).
 */
export function useMessageReplies(actorId: string, messageId: string) {
  const interval = useLiveInterval(3000);
  return useInfiniteQuery({
    // 끝의 'paged' — 콘솔 "답장 모아보기"(use-console)의 일반 쿼리와 키가 겹치면 모양이 달라 화면이 깨짐(2026-10-29). 무효화는 앞부분으로 그대로 됨
    queryKey: ['actor-replies', actorId, messageId, 'paged'],
    queryFn: ({ pageParam }) =>
      apiClient.get<FanReply[]>(
        `/actors/${actorId}/messages/replies?messageId=${encodeURIComponent(messageId)}&limit=${REPLIES_PAGE_SIZE}` +
          (pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.length === REPLIES_PAGE_SIZE ? lastPage[lastPage.length - 1].id : undefined),
    enabled: !!actorId && !!messageId,
    refetchInterval: interval,
  });
}

export interface Attachment {
  mediaType: UploadMediaType;
  uri: string;
  contentType?: string;
  /** 음성 녹음일 때 — 카톡식 음파 표시용 */
  durationMs?: number;
  waveform?: number[];
}

// 영상 첫 장면을 사진으로 올림(+ 그 장면의 흐린 미리보기 값) — 썸네일은 선택이라 만들기·올리기가 실패해도 영상은 그대로 보냄
async function uploadVideoThumbnail(actorId: string, videoUri: string): Promise<{ key?: string; thumbhash?: string }> {
  const uri = await createVideoThumbnail(videoUri);
  if (!uri) return {};
  try {
    const [key, thumbhash] = await Promise.all([
      uploadMedia(actorId, { purpose: 'message', mediaType: 'PHOTO', uri, contentType: 'image/jpeg' }),
      thumbhashFor(uri),
    ]);
    return { key, thumbhash };
  } catch {
    return {};
  } finally {
    // 웹은 캡처 결과가 blob: 주소라 올린 뒤 메모리 해제
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
  }
}

interface UploadedMedia {
  mediaKey?: string;
  thumbnailKey?: string;
  thumbhash?: string;
}

// 못 보낸 메시지의 중복 방지 키 + 이미 올린 파일(2026-10-25) — 앱이 켜져 있는 동안 남음(화면을 나갔다 와도). 저장소는 하루가
// 지나야 붙이지 않은 파일을 지우므로(UploadCleanupService) 그 안에 다시 보내면 올린 파일을 그대로 씀
const pendingBroadcasts = new PendingSends<UploadedMedia>();
// 로그아웃하면 비움(2026-10-28) — use-messages와 같게, 같은 기기의 다음 계정이 앞 사람의 키·올린 파일을 쓰지 않게
onSessionReset(() => pendingBroadcasts.clear());

// 미디어가 있으면 먼저 저장소에 올리고(uploadMedia) 받은 키로 발송 — 영상이면 첫 장면 썸네일도 같이.
// onProgress로 올라간 정도(0~1)를, signal로 취소를 받음(큰 영상이 멈춘 것처럼 보이지 않게, 2026-09-28 점검).
// 중복 방지 키를 붙여서(2026-10-25) 연결이 끊겨 실패하면 자동으로 2번 더, 그래도 안 되면 화면의 "다시 보내기" — 서버가 이미
// 저장했으면 같은 메시지를 돌려줘서 팬에게 두 번 가거나 알림이 두 번 울리지 않음
export function useStudioSend(actorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      body,
      attachment,
      replyToMessageId,
      silent,
      batchCount,
      onProgress,
      signal,
    }: {
      body: string;
      attachment: Attachment | null;
      /** 인용 답장할 팬 메시지 */
      replyToMessageId?: string;
      /** 여러 장 보내기 — 묶음의 앞쪽(푸시 없음), 마지막 사진·영상엔 묶음 개수(알림 한 건) */
      silent?: boolean;
      batchCount?: number;
    } & UploadOptions) => {
      // 같은 첨부·같은 글·같은 인용이면 같은 메시지(여러 장 보내기는 장마다 파일이 달라서 키도 다름)
      const signature = `${actorId}|${attachment?.uri ?? ''}|${body}|${replyToMessageId ?? ''}`;
      const clientMessageId = pendingBroadcasts.keyFor(signature);
      try {
        // 지난번에 올리기까지 끝났으면 다시 올리지 않음(큰 영상을 또 올리지 않게)
        const uploaded =
          pendingBroadcasts.extra(signature) ??
          (await (async (): Promise<UploadedMedia> => {
            const [mediaKey, videoThumb, photoHash] = await Promise.all([
              attachment
                ? uploadMedia(
                    actorId,
                    { purpose: 'message', mediaType: attachment.mediaType, uri: attachment.uri, contentType: attachment.contentType },
                    { onProgress, signal },
                  )
                : undefined,
              attachment?.mediaType === 'VIDEO' ? uploadVideoThumbnail(actorId, attachment.uri) : undefined,
              attachment?.mediaType === 'PHOTO' ? thumbhashFor(attachment.uri) : undefined,
            ]);
            return { mediaKey, thumbnailKey: videoThumb?.key, thumbhash: photoHash ?? videoThumb?.thumbhash };
          })());
        if (signal?.aborted) throw new UploadCancelledError('upload cancelled');
        pendingBroadcasts.setExtra(signature, uploaded);
        const message = await apiClient.post<ChatMessage>(`/actors/${actorId}/messages/broadcast`, {
          mediaType: attachment?.mediaType ?? 'TEXT',
          body: body || undefined,
          ...uploaded,
          durationMs: attachment?.durationMs,
          waveform: attachment?.waveform,
          replyToMessageId,
          silent: silent || undefined,
          batchCount,
          clientMessageId,
        });
        pendingBroadcasts.settle(signature);
        return message;
      } catch (error) {
        pendingBroadcasts.settle(signature, error);
        throw error;
      }
    },
    ...SEND_RETRY,
    // 실패해도 새로고침 — 응답만 끊긴 경우 서버엔 저장돼 있음(2026-10-25)
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['actor-broadcasts', actorId] });
      void queryClient.invalidateQueries({ queryKey: ['actor-stats', actorId] });
    },
  });
}

// 보낸 메시지 삭제(보내기 취소) — 팬 화면에서 사라짐, 소속사 모니터링엔 "삭제한 메시지"로 남음
export function useDeleteBroadcast(actorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => apiClient.delete(`/actors/${actorId}/messages/${messageId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['actor-broadcasts', actorId] }),
  });
}

