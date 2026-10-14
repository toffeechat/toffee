import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLiveInterval } from '@/lib/realtime';
import type { Actor } from './use-actors';
import type { ChatMessage } from './use-messages';

/** 내가 보낼 수 있는/관리하는 방 — lastBroadcastAt: 소속사 목록의 "N일째 미발송"(2026-09-29), lastMessage: 토피룸 목록 미리보기(2026-10-14) */
export type MyActor = Actor & {
  lastBroadcastAt?: string | null;
  lastMessage?: { body: string | null; mediaType: string; createdAt: string } | null;
};

export function useMyActors() {
  return useQuery({
    queryKey: ['my-actors'],
    queryFn: () => apiClient.get<MyActor[]>('/actors/mine'),
  });
}

/** 기간(일) — 대시보드·아티스트별 통계 공통 [7일][30일][90일] */
export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export type RoomKindFilter = 'ALL' | 'SOLO' | 'COUPLE';
/** 통계 기간 — 최근 N일 버튼 또는 직접 고른 날짜(태국 날짜 YYYY-MM-DD, 양 끝 포함, 최대 1년 — 2026-10-13) */
export type StatsSelection = { days: StatsPeriod } | { from: string; to: string };

/** "전체 순위" 화면으로 넘길 주소 값 / 받은 값 → 기간 */
export function selectionParams(selection: StatsSelection): Record<string, string> {
  return 'days' in selection ? { days: String(selection.days) } : { from: selection.from, to: selection.to };
}
export function selectionFromParams(params: { days?: string; from?: string; to?: string }): StatsSelection {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (params.from && params.to && pattern.test(params.from) && pattern.test(params.to)) return { from: params.from, to: params.to };
  return { days: STATS_PERIODS.find((value) => String(value) === params.days) ?? 30 };
}

export function selectionQuery(selection: StatsSelection): string {
  return 'days' in selection ? `days=${selection.days}` : `from=${selection.from}&to=${selection.to}`;
}

/** 서버가 정한 실제 기간 + "구독 중"·팬 분포의 기준(지난 날짜면 그날 하루 기록) */
interface RangeInfo {
  from: string;
  to: string;
  days: number;
  /** 3개월보다 길면 추이가 1주씩 묶여 옴(점의 day = 그 주 첫날) */
  bucket: 'day' | 'week';
  /** null = 지금 상태, 날짜 = 그날 하루 기록 */
  audienceAsOf: string | null;
  /** false = 그날 하루 기록이 없음(기록 시작 전) */
  audienceRecorded: boolean;
  /** true = 팬 수가 여러 방 구독자를 한 번만 센 값, false = 방마다 더한 구독 수(지난 날짜) */
  distinctFans: boolean;
}

export interface ActivityTotals {
  newSubscriptions: number;
  cancellations: number;
  messagesSent: number;
  fanReplies: number;
}
export interface DailyActivity extends ActivityTotals {
  day: string;
}
/** 나라·언어 분포 — 팬이 적은 묶음은 서버가 "other"로 합쳐 보냄(특정 팬을 짐작 못 하게) */
export interface DistributionRow {
  key: string;
  count: number;
}

export interface ActorStats extends RangeInfo {
  /** 지난 날짜인데 기록이 없으면 null */
  subscriberCount: number | null;
  lastBroadcastAt: string | null;
  totals: ActivityTotals;
  previous: ActivityTotals;
  daily: DailyActivity[];
  fans: number;
  countries: DistributionRow[];
  languages: DistributionRow[];
  mediaMix: DistributionRow[];
  topMessages: { id: string; body: string | null; mediaType: string; createdAt: string; replyCount: number }[];
}

export function useActorStats(actorId: string, selection: StatsSelection = { days: 30 }) {
  const query = selectionQuery(selection);
  return useQuery({
    queryKey: ['actor-stats', actorId, query],
    queryFn: () => apiClient.get<ActorStats>(`/actors/${actorId}/stats?${query}`),
    enabled: !!actorId,
    placeholderData: (previous) => previous,
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

/** 소속사 통계 대시보드(2026-10-12, 10-13 개편) — 볼 수 있는 방 전체의 최근 N일 수치 */
export interface DashboardRow extends ActivityTotals {
  id: string;
  kind: 'SOLO' | 'COUPLE';
  chatDisplayName: string;
  legalName: string;
  chatProfileImageUrl: string | null;
  retiredAt: string | null;
  lastBroadcastAt: string | null;
  subscriberCount: number;
}

export interface AgencyDashboard extends RangeInfo {
  kind: RoomKindFilter;
  totals: ActivityTotals & { subscribers: number | null };
  previous: ActivityTotals;
  daily: DailyActivity[];
  fans: number;
  countries: DistributionRow[];
  languages: DistributionRow[];
  actors: DashboardRow[];
}

export function useAgencyDashboard(selection: StatsSelection = { days: 30 }, kind: RoomKindFilter = 'ALL') {
  const query = selectionQuery(selection);
  return useQuery({
    queryKey: ['agency-dashboard', query, kind],
    queryFn: () => apiClient.get<AgencyDashboard>(`/actors/mine/dashboard?${query}&kind=${kind}`),
    // 필터를 바꾸는 동안 이전 숫자를 그대로 보여 줌(화면이 깜빡이지 않게)
    placeholderData: (previous) => previous,
  });
}

/** 소속사 "기록"(2026-10-13) — 소속 아티스트 방의 차단·신고·메시지 삭제. by = 한 사람의 역할(ACTOR/AGENCY_STAFF/ADMIN) */
export interface RecordRoom {
  id: string;
  chatDisplayName: string;
  kind: 'SOLO' | 'COUPLE';
}
export interface RecordFan {
  id: string;
  nickname: string | null;
  tag: string;
}
export interface AgencyRecords {
  limit: number;
  blocks: {
    room: RecordRoom | null;
    createdAt: string;
    reason: string | null;
    by: string;
    byMe: boolean;
    fanUser: RecordFan | null;
    message: { id: string; body: string | null; createdAt: string } | null;
  }[];
  reports: {
    id: string;
    room: RecordRoom | null;
    category: string;
    reason: string | null;
    status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
    createdAt: string;
    resolvedAt: string | null;
    by: string;
    byMe: boolean;
    message: { id: string; body: string | null; mediaType: string; senderType: string; createdAt: string; fanUser: RecordFan | null };
  }[];
  deleted: {
    id: string;
    room: RecordRoom | null;
    body: string | null;
    mediaType: string;
    createdAt: string;
    deletedAt: string;
    by: string;
    byMe: boolean;
  }[];
}

export function useAgencyRecords(actorId?: string | null) {
  return useQuery({
    queryKey: ['agency-records', actorId ?? null],
    queryFn: () => apiClient.get<AgencyRecords>(`/actors/mine/records${actorId ? `?actorId=${encodeURIComponent(actorId)}` : ''}`),
    placeholderData: (previous) => previous,
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
