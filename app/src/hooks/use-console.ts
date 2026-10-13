import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLiveInterval } from '@/lib/realtime';
import type { Actor } from './use-actors';
import type { ChatMessage } from './use-messages';

export function useMyActors() {
  return useQuery({
    queryKey: ['my-actors'],
    // lastBroadcastAt: 마지막 스타 메시지 시각 — 소속사 목록의 "N일째 미발송" 표시(2026-09-29)
    queryFn: () => apiClient.get<(Actor & { lastBroadcastAt?: string | null })[]>('/actors/mine'),
  });
}

export interface ActorStats {
  subscriberCount: number;
  lastBroadcastAt: string | null;
}

export function useActorStats(actorId: string) {
  return useQuery({
    queryKey: ['actor-stats', actorId],
    queryFn: () => apiClient.get<ActorStats>(`/actors/${actorId}/stats`),
    enabled: !!actorId,
  });
}

export interface FanReply extends ChatMessage {
  // 스타·소속사에겐 닉네임 + 같은 닉네임 구분용 태그(#A1B2)만 — 로그인 이름(실명일 수 있음)은 안 옴
  fanUser: {
    id: string;
    nickname: string | null;
    tag: string;
    /** 팬 프로필 사진·상태메시지(2026-10-12) */
    profileImageUrl?: string | null;
    statusMessage?: string | null;
  } | null;
}

// messageId를 주면 그 아티스트 메시지에 온 답장만(모니터링에서 "답장 N개" 눌렀을 때, 2026-10-12)
export function useActorReplies(actorId: string, messageId?: string | null) {
  const interval = useLiveInterval(10000);
  return useQuery({
    queryKey: ['actor-replies', actorId, messageId ?? null],
    queryFn: () => apiClient.get<FanReply[]>(`/actors/${actorId}/messages/replies${messageId ? `?messageId=${encodeURIComponent(messageId)}` : ''}`),
    enabled: !!actorId,
    refetchInterval: interval,
  });
}

/** 소속사 통계 대시보드(2026-10-12) — 볼 수 있는 방 전체의 최근 N일 수치 */
export interface DashboardRow {
  id: string;
  kind: 'SOLO' | 'COUPLE';
  chatDisplayName: string;
  legalName: string;
  chatProfileImageUrl: string | null;
  retiredAt: string | null;
  lastBroadcastAt: string | null;
  subscriberCount: number;
  newSubscriptions: number;
  cancellations: number;
  messagesSent: number;
  fanReplies: number;
}

export function useAgencyDashboard() {
  return useQuery({
    queryKey: ['agency-dashboard'],
    queryFn: () => apiClient.get<{ days: number; actors: DashboardRow[] }>('/actors/mine/dashboard'),
  });
}

interface SendBroadcastInput {
  mediaType: 'TEXT' | 'PHOTO' | 'AUDIO' | 'VIDEO';
  body?: string;
  // uploadMedia(purpose: 'message')로 먼저 올리고 받은 objectKey
  mediaKey?: string;
}

// 배우 본인 전용 — 소속사 콘솔에서는 안 씀(발송 권한 없음). 배우용 화면 만들 때 재사용
export function useSendBroadcast(actorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendBroadcastInput) =>
      apiClient.post<ChatMessage>(`/actors/${actorId}/messages/broadcast`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actor-stats', actorId] });
    },
  });
}

export interface ActorStory {
  id: string;
  actorId: string;
  mediaType: 'PHOTO' | 'AUDIO' | 'VIDEO';
  // 서버가 발급한 임시 조회 URL(약 1~2시간 유효) — 오래 들고 있지 말고 다시 조회해서 쓸 것
  mediaUrl: string | null;
  createdAt: string;
  expiresAt: string;
}

// 소속사 모니터링 — 배우가 올린 스토리(만료 안 된 것) 읽기 전용 조회
export function useActorStories(actorId: string) {
  return useQuery({
    queryKey: ['actor-stories', actorId],
    queryFn: () => apiClient.get<ActorStory[]>(`/actors/${actorId}/stories`),
    enabled: !!actorId,
    refetchInterval: 10000,
  });
}
