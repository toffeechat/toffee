import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Bundle } from './use-bundles';
import type { ArtistGender, CoupleMemberActor } from './use-actors';
import { apiClient } from '@/lib/api-client';
import { selectionQuery, type StatsSelection } from './use-console';
import { uploadInquiryPhotos, type InquiryCategory, type InquiryPhoto, type PickedPhoto } from './use-support';

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

// 같은 메시지 신고는 서버가 한 줄로 묶고(reportCount), 대기 중은 여러 명이 신고한 것부터, 처리한 건 최근 처리 순
export interface AdminReport {
  id: string;
  category: string;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  reportCount: number;
  categories: string[];
  message: {
    id: string;
    actorId: string;
    senderType: 'ARTIST' | 'FAN';
    body: string | null;
    mediaType: string;
    createdAt: string;
    fanUser: { id: string; nickname: string | null; displayName: string; status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' } | null;
    actor: { chatDisplayName: string; legalName: string; kind: 'SOLO' | 'COUPLE'; agencyNames: string[] };
  };
  reportedBy: { id: string; displayName: string; nickname: string | null; role: string };
}

export interface AdminReportFilter {
  status?: ReportStatus;
  category?: string;
  agencyId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface AdminReportList {
  /** 상태만 빼고 같은 필터의 줄 수(요약 카드) */
  counts: Record<'ALL' | ReportStatus, number>;
  byActor: { actorId: string; name: string; count: number }[];
  items: AdminReport[];
}

/** 운영자 신고 화면(2026-10-20 개편) — 상태·사유·소속사·아티스트·기간(태국 날짜) */
export function useAdminReports(filter: AdminReportFilter) {
  const query = new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => !!entry[1])).toString();
  return useQuery({
    queryKey: ['admin', 'reports', query],
    queryFn: () => apiClient.get<AdminReportList>(`/reports/admin${query ? `?${query}` : ''}`),
    placeholderData: (previous) => previous,
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/reports/${id}/resolve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats', 'summary'] });
    },
  });
}

export function useDismissReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/reports/${id}/dismiss`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats', 'summary'] });
    },
  });
}

/** 금칙어 언어 — 앱 언어 9개(2026-10-20, 예전엔 ko/th/en) */
export type BannedWordLanguage = 'ko' | 'th' | 'en' | 'ja' | 'zh-Hans' | 'zh-Hant' | 'vi' | 'es' | 'pt-BR';

export interface BannedWord {
  id: string;
  term: string;
  language: BannedWordLanguage;
  /** [기본 목록 넣기]로 들어온 단어 */
  isDefault: boolean;
  createdAt: string;
}

export function useBannedWords() {
  return useQuery({
    queryKey: ['admin', 'banned-words'],
    queryFn: () => apiClient.get<BannedWord[]>('/admin/banned-words'),
  });
}

function useBannedWordMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: request, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'banned-words'] }) });
}

export function useCreateBannedWord() {
  return useBannedWordMutation((input: { term: string; language: BannedWordLanguage }) => apiClient.post<BannedWord>('/admin/banned-words', input));
}

export function useDeleteBannedWord() {
  return useBannedWordMutation((id: string) => apiClient.delete(`/admin/banned-words/${id}`));
}

/** 기본 목록 넣기(2026-10-20) — 언어를 빼면 9개 언어 전부, 이미 있는 건 건너뜀 */
export function useAddDefaultBannedWords() {
  return useBannedWordMutation((language: BannedWordLanguage | undefined) => apiClient.post<{ added: number }>('/admin/banned-words/defaults', { language }));
}

/** 테스트해 보기 — 이 글이 막히는지, 어떤 단어 때문인지(저장 안 함) */
export function useTestBannedWords() {
  return useMutation({ mutationFn: (text: string) => apiClient.post<{ hits: { id: string; term: string; language: BannedWordLanguage }[] }>('/admin/banned-words/test', { text }) });
}

// ── 회원 ──

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type AssignableRole = 'USER' | 'ACTOR' | 'AGENCY_STAFF';

export type SanctionCategory = 'SPAM' | 'ABUSE' | 'SEXUAL' | 'PRIVACY' | 'OTHER';

export interface AdminUser {
  id: string;
  displayName: string;
  nickname: string | null;
  email: string | null;
  role: AssignableRole | 'ADMIN';
  status: AdminUserStatus;
  suspendedUntil: string | null;
  bannedAt: string | null;
  /** 제재 사유 분류(당사자에게 번역해서 안내)·내부 메모 */
  sanctionCategory: SanctionCategory | null;
  sanctionNote: string | null;
  /** 팬 프로필(2026-10-12) — 사진은 있는지만 보면 됨(저장소 키) */
  statusMessage?: string | null;
  profileImageUrl?: string | null;
  createdAt: string;
  deletedAt: string | null;
  /** 마지막 접속(한 시간 단위로 갱신)·마지막으로 쓴 기기(2026-10-14) */
  lastActiveAt?: string | null;
  accessLogs?: Pick<AccessLog, 'platform' | 'deviceModel' | 'osVersion' | 'appVersion' | 'createdAt'>[];
  agency: { id: string; name: string } | null;
  actorSelf: { id: string; legalName: string } | null;
}

/** 접속 기록 한 줄 — LOGIN(로그인할 때마다) / VISIT(로그인 유지 중 한 시간에 한 번) */
export interface AccessLog {
  id: string;
  kind: 'LOGIN' | 'VISIT';
  /** 로그인 수단(GOOGLE·KAKAO… 또는 DEV = 데모 이메일 로그인) */
  method: string | null;
  platform: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  ip: string | null;
  createdAt: string;
}

export type AdminUserSort = 'recent';

export interface AdminUserPage {
  items: AdminUser[];
  /** 검색어만 건 역할별 인원(탭 옆 숫자) */
  counts: Record<'ALL' | AdminUser['role'], number>;
  /** 지금 역할 탭의 인원 */
  total: number;
  page: number;
  pageSize: number;
}

/** 회원 목록 기간 필터(2026-10-25) — 가입일(joined) 또는 마지막 접속(active)이 그 기간 */
export type AdminUserPeriod = { field: 'joined' | 'active'; selection: StatsSelection };

/** 회원 목록(2026-10-20: 한 쪽 50명씩 + 역할별 인원수) */
export function useAdminUsers(query: string, role?: AdminUser['role'], sort?: AdminUserSort, page = 1, period?: AdminUserPeriod | null) {
  const periodQuery = period ? `dateField=${period.field}&${selectionQuery(period.selection)}` : '';
  return useQuery({
    queryKey: ['admin', 'users', 'list', query, role ?? null, sort ?? null, page, periodQuery],
    queryFn: () => {
      const params = new URLSearchParams(periodQuery);
      if (query) params.set('q', query);
      if (role) params.set('role', role);
      if (sort) params.set('sort', sort);
      if (page > 1) params.set('page', String(page));
      const qs = params.toString();
      return apiClient.get<AdminUserPage>(`/admin/users${qs ? `?${qs}` : ''}`);
    },
    placeholderData: (previous) => previous,
  });
}

/** 회원 한 명(회원 상세 화면, 신고에서 바로 제재) */
export function useAdminUser(id: string) {
  return useQuery({ queryKey: ['admin', 'users', 'one', id], queryFn: () => apiClient.get<AdminUser>(`/admin/users/${id}`), enabled: !!id });
}

export function useAdminUserAccessLogs(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'access-logs'],
    queryFn: () => apiClient.get<AccessLog[]>(`/admin/users/${userId}/access-logs`),
    enabled,
  });
}

// 역할이 바뀌면 배우 본인 연결·소속사 배정이 끊길 수 있어서 배우/소속사 목록도 같이 새로고침
function invalidateAdminAccounts(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'actors'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AssignableRole }) => apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role }),
    onSuccess: () => invalidateAdminAccounts(queryClient),
  });
}

export function useAssignStaffAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agencyId }: { id: string; agencyId: string | null }) =>
      apiClient.patch(`/admin/users/${id}/agency`, { agencyId }),
    onSuccess: () => invalidateAdminAccounts(queryClient),
  });
}

// ── 소속사 ──────────────────────────────────────────────

export interface AdminAgency {
  id: string;
  name: string;
  logoUrl: string | null;
  // 정산 배분율(%) — null이면 서버 기본값(잠정 60)
  revenueSharePercent: number | null;
  createdAt: string;
  actorCount: number;
  staffCount: number;
}

export function useAdminAgencies() {
  return useQuery({
    queryKey: ['admin', 'agencies'],
    queryFn: () => apiClient.get<AdminAgency[]>('/admin/agencies'),
  });
}

export function useCreateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiClient.post<AdminAgency>('/admin/agencies', { name }),
    onSuccess: () => invalidateAdminAccounts(queryClient),
  });
}

export function useUpdateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; logoUrl?: string | null; revenueSharePercent?: number | null }) =>
      apiClient.patch<AdminAgency>(`/admin/agencies/${id}`, input),
    onSuccess: () => {
      invalidateAdminAccounts(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['agencies'] });
      void queryClient.invalidateQueries({ queryKey: ['actors'] });
    },
  });
}

// 배분율 이력(2026-10-27) — 정산은 결제가 속한 달의 비율. percent null = 기본값
export interface AgencyShareRates {
  currentMonth: string;
  currentPercent: number;
  defaultPercent: number;
  /** 마지막으로 마감한 달 — 이 달까지는 못 바꿈 */
  lastClosedMonth: string | null;
  rates: { fromMonth: string; percent: number | null; createdAt: string }[];
}

export function useAgencyShareRates(id: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'agencies', id, 'share-rates'],
    queryFn: () => apiClient.get<AgencyShareRates>(`/admin/agencies/${id}/share-rates`),
    enabled,
  });
}

function useShareRateMutation<T>(id: string, fn: (input: T) => Promise<AgencyShareRates>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'agencies', id, 'share-rates'], data);
      invalidateAdminAccounts(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['settlement'] });
    },
  });
}

export function useSetAgencyShareRate(id: string) {
  return useShareRateMutation(id, (input: { fromMonth: string; percent: number | null }) =>
    apiClient.post<AgencyShareRates>(`/admin/agencies/${id}/share-rates`, input),
  );
}

export function useDeleteAgencyShareRate(id: string) {
  return useShareRateMutation(id, (fromMonth: string) => apiClient.delete<AgencyShareRates>(`/admin/agencies/${id}/share-rates/${fromMonth}`));
}

export function useApplyFoundingShare(id: string) {
  return useShareRateMutation(id, (input: { fromMonth: string }) =>
    apiClient.post<AgencyShareRates>(`/admin/agencies/${id}/share-rates/founding`, input),
  );
}

// ── 배우 ──────────────────────────────────────────────

export interface AdminActor {
  id: string;
  legalName: string;
  officialProfileImageUrl: string | null;
  chatDisplayName: string;
  chatProfileImageUrl: string | null;
  /** 상태메시지(2026-10-25) — 아티스트 본인이 씀, 운영자는 지우기만. 커플방은 늘 null(멤버별) */
  statusMessage: string | null;
  monthlyPriceCents: number;
  storeProductId: string | null;
  verified: boolean;
  /** 성별(둘러보기 여성·남성 줄) — null이면 지정 안 함, 커플방은 항상 null */
  gender: ArtistGender | null;
  kind: 'SOLO' | 'COUPLE';
  coupleMembers: { member: CoupleMemberActor }[];
  /** 활동 종료 시각(종료 안 했으면 null) */
  retiredAt: string | null;
  /** 활동 종료 예정 시각(2026-10-20) — 있으면 새 구독이 막혀 있음 */
  retireAt: string | null;
  /** 계약 끝나는 날(2026-10-20, 태국 날짜 0시) — 지나도 자동 종료 안 함 */
  contractEndAt: string | null;
  createdAt: string;
  agency: { id: string; name: string; logoUrl: string | null } | null;
  selfUser: { id: string; displayName: string; email: string | null } | null;
  activeSubscriberCount: number;
  /** 마지막 스타 메시지 시각(목록에서만, 없으면 null) — "N일째 미발송" 표시 */
  lastBroadcastAt?: string | null;
  /** 공개 시각(2026-10-19 예약 오픈) — 미래면 팬 화면에 "곧 공개" */
  releaseAt: string | null;
  /** "곧 공개" 알림 신청 수(사전 수요) */
  releaseWatchCount: number;
  /** 아직 안 쓴 계정 연결 링크의 만료 시각(없으면 null) */
  linkPendingUntil: string | null;
}

export interface AgencyHistoryEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  agency: { id: string; name: string };
}

export function useAdminActors(query: string) {
  return useQuery({
    queryKey: ['admin', 'actors', 'list', query],
    queryFn: () => apiClient.get<AdminActor[]>(`/admin/actors${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useAdminActor(id: string) {
  return useQuery({
    queryKey: ['admin', 'actors', id],
    queryFn: () => apiClient.get<AdminActor>(`/admin/actors/${id}`),
  });
}

export function useActorAgencyHistory(id: string) {
  return useQuery({
    queryKey: ['admin', 'actors', id, 'history'],
    queryFn: () => apiClient.get<AgencyHistoryEntry[]>(`/admin/actors/${id}/agency-history`),
  });
}

// 배우 정보가 바뀌면 팬 쪽 목록(['actors'])·운영자 목록 둘 다 새로고침
function useActorMutation<TInput, TOutput = unknown>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'actors'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['actors'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contracts-ending'] });
    },
  });
}

export function useUpdateActor(id: string) {
  return useActorMutation(
    (input: {
      legalName?: string;
      chatDisplayName?: string;
      monthlyPriceCents?: number;
      verified?: boolean;
      gender?: ArtistGender | null;
      storeProductId?: string | null;
      releaseAt?: string | null;
    }) =>
      apiClient.patch<AdminActor>(`/admin/actors/${id}`, input),
  );
}

export function useUpdateActorImages(id: string) {
  return useActorMutation((input: { officialProfileImageKey?: string | null; chatProfileImageKey?: string | null }) =>
    apiClient.patch<AdminActor>(`/admin/actors/${id}/images`, input),
  );
}

export function useAssignActorAgency(id: string) {
  return useActorMutation((agencyId: string | null) => apiClient.patch(`/admin/actors/${id}/agency`, { agencyId }));
}

export function useLinkActorUser(id: string) {
  return useActorMutation((userId: string | null) => apiClient.patch<AdminActor>(`/admin/actors/${id}/self-user`, { userId }));
}

export function useSetActorRetired(id: string) {
  return useActorMutation((retired: boolean) => apiClient.patch<AdminActor>(`/admin/actors/${id}/retire`, { retired }));
}

/** 활동 종료 예정(2026-10-20) — ISO 또는 null(예정 취소). 정하는 즉시 새 구독이 막히고 그 시각에 자동 종료 */
export function useSetActorRetireAt(id: string) {
  return useActorMutation((retireAt: string | null) => apiClient.patch<AdminActor>(`/admin/actors/${id}/retire-at`, { retireAt }));
}

/** 아티스트 상태메시지 지우기(2026-10-25) — 작업 기록에 지운 문구가 남음 */
export function useClearActorStatusMessage(id: string) {
  return useActorMutation(() => apiClient.patch<AdminActor>(`/admin/actors/${id}/clear-status-message`));
}

export function useSetActorContractEnd(id: string) {
  return useActorMutation((contractEndAt: string | null) => apiClient.patch<AdminActor>(`/admin/actors/${id}/contract`, { contractEndAt }));
}

/** 계약 종료 31일 이내(운영자 홈 할 일) */
export interface ContractEndingRow {
  id: string;
  chatDisplayName: string;
  legalName: string;
  kind: 'SOLO' | 'COUPLE';
  contractEndAt: string;
  retireAt: string | null;
  agency: { name: string } | null;
}

export function useContractsEnding() {
  return useQuery({ queryKey: ['admin', 'contracts-ending'], queryFn: () => apiClient.get<ContractEndingRow[]>('/admin/contracts-ending') });
}

// ── 아티스트 일괄 등록·계정 연결 링크(2026-10-19) ──

export interface ImportRow {
  legalName: string;
  chatDisplayName?: string;
  gender?: ArtistGender | null;
  partners?: string[];
}

export interface ImportPlan {
  rows: { index: number; legalName: string; chatDisplayName: string; gender: ArtistGender | null; partners: string[]; status: 'new' | 'exists' | 'error'; errors: string[] }[];
  couples: { legalName: string; memberNames: [string, string]; status: 'new' | 'exists' }[];
  /** 직접 고른 CP방 중 만들 수 없는 것 */
  coupleErrors: string[];
  errorCount: number;
}

export interface ImportInput {
  agencyId?: string;
  monthlyPriceCents: number;
  couplePriceCents: number;
  releaseAt?: string | null;
  dryRun: boolean;
  rows: ImportRow[];
  /** 화면에서 멤버를 고른 CP방 — rows의 번호 또는 이미 등록된 아티스트 id */
  couples?: { members: ({ row: number } | { actorId: string })[] }[];
}

export interface ImportResult {
  plan: ImportPlan;
  created: { actors: { id: string; legalName: string }[]; couples: { id: string; legalName: string }[] } | null;
}

// 미리보기(dryRun)는 아무것도 안 바꿔서 캐시를 건드리지 않음
export function useImportActors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportInput) => apiClient.post<ImportResult>('/admin/actors/import', input),
    onSuccess: (_, input) => {
      if (input.dryRun) return;
      for (const queryKey of [['admin', 'actors'], ['admin', 'agencies'], ['actors']]) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export interface IssuedLinks {
  links: { actorId: string; legalName: string; token: string; expiresAt: string }[];
  skipped: { actorId: string; legalName: string; reason: 'COUPLE' | 'LINKED' }[];
}

export function useIssueActorLinks() {
  return useActorMutation((actorIds: string[]) => apiClient.post<IssuedLinks>('/admin/actors/link-tokens', { actorIds }));
}

export function useRevokeActorLink(id: string) {
  return useActorMutation(() => apiClient.delete<{ revoked: number }>(`/admin/actors/${id}/link-token`));
}

export interface AdminActionEntry {
  id: string;
  action: string;
  targetType: 'USER' | 'REPORT' | 'ACTOR';
  targetId: string;
  targetName: string | null;
  adminName: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** 운영자 작업 기록(최근 100건) */
export function useAdminActions() {
  return useQuery({
    queryKey: ['admin', 'actions'],
    queryFn: () => apiClient.get<AdminActionEntry[]>('/admin/actions'),
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, until, category, note }: { id: string; until: string; category: SanctionCategory; note?: string }) =>
      apiClient.patch<AdminUser>(`/admin/users/${id}/suspend`, { until, category, note: note || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category, note }: { id: string; category: SanctionCategory; note?: string }) =>
      apiClient.patch<AdminUser>(`/admin/users/${id}/ban`, { category, note: note || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<AdminUser>(`/admin/users/${id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// 팬 프로필 사진·상태메시지 지우기(2026-10-12, 신고·민원 대응, 작업 기록에 남음)
export function useClearUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<AdminUser>(`/admin/users/${id}/clear-profile`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// ── 통계(2026-09-28) — 앱 홈은 summary 숫자, 통계 화면은 일별 추이·분포 ──────────────

export interface AdminStatsSummary {
  timeZone: string;
  fans: { total: number; newToday: number; new7d: number; activeToday: number; active30d: number };
  subscriptions: {
    active: number;
    subscribedFans: number;
    subscriptionRate: number;
    startedToday: number;
    cancelledToday: number;
    started30d: number;
    cancelled30d: number;
  };
  reports: { pending: number };
  messages: { starToday: number; fanRepliesToday: number };
}

/** 운영자 홈 서비스 전체 추이(2026-10-20) — 기간은 소속사 대시보드와 같은 선택(최근 N일 또는 직접 고른 날짜, 최대 1년) */
export interface AdminOverviewTotals {
  signups: number;
  /** 그 기간에 새로 시작한 구독의 적용 가격 합(할인 반영) */
  newRevenueCents: number;
}
export interface AdminOverview {
  from: string;
  to: string;
  days: number;
  bucket: 'day' | 'week';
  totals: AdminOverviewTotals;
  previous: AdminOverviewTotals;
  daily: (AdminOverviewTotals & { day: string })[];
}

export interface AdminStatsBreakdown {
  countries: { key: string; count: number }[];
  platforms: { key: string; count: number }[];
  locales: { key: string; count: number }[];
  providers: { key: string; count: number }[];
}

// ── 운영자 홈 "최근 오류"(2026-10-25) — 서버가 Sentry API에서 5분 캐시로 가져옴 ──

export interface AdminErrorIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  project: string;
  count: number;
  count24h: number;
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  url: string;
}

export type AdminErrors =
  | { status: 'NOT_CONNECTED'; missing: string[] }
  | { status: 'OK' | 'FAILED'; fetchedAt: string | null; listUrl: string; issues: AdminErrorIssue[]; total24h: number; error?: string };

export function useAdminErrors() {
  return useQuery({ queryKey: ['admin', 'stats', 'errors'], queryFn: () => apiClient.get<AdminErrors>('/admin/stats/errors'), refetchInterval: 5 * 60_000 });
}

export function useAdminStatsSummary() {
  return useQuery({
    queryKey: ['admin', 'stats', 'summary'],
    queryFn: () => apiClient.get<AdminStatsSummary>('/admin/stats/summary'),
    refetchInterval: 60_000,
  });
}

export function useAdminStatsOverview(selection: StatsSelection) {
  const query = selectionQuery(selection);
  return useQuery({
    queryKey: ['admin', 'stats', 'overview', query],
    queryFn: () => apiClient.get<AdminOverview>(`/admin/stats/overview?${query}`),
    placeholderData: (previous) => previous,
  });
}

/** 그 기간 구독 시작·해지 한 건(2026-10-25, 운영자 홈 "오늘 구독 시작" 카드 → 구독 목록) */
export interface AdminSubscriptionEvent {
  id: string;
  type: 'STARTED' | 'CANCELLED';
  priceCents: number | null;
  createdAt: string;
  user: { id: string; displayName: string; nickname: string | null; deletedAt: string | null };
  actor: { id: string; chatDisplayName: string; legalName: string; kind: 'SOLO' | 'COUPLE' };
}

export function useAdminSubscriptionEvents(selection: StatsSelection, type: AdminSubscriptionEvent['type']) {
  const query = `${selectionQuery(selection)}&type=${type}`;
  return useQuery({
    queryKey: ['admin', 'stats', 'subscription-events', query],
    queryFn: () =>
      apiClient.get<{ items: AdminSubscriptionEvent[]; counts: Record<AdminSubscriptionEvent['type'], number>; limit: number }>(`/admin/stats/subscription-events?${query}`),
    placeholderData: (previous) => previous,
  });
}

/** 그 기간 방별 아티스트 메시지·팬 답장 수(2026-10-25, "오늘 메시지" 카드 → 토피룸 모니터링). selection이 없으면 안 불러옴 */
export function useAdminMessageRooms(selection: StatsSelection | null) {
  const query = selection ? selectionQuery(selection) : '';
  return useQuery({
    queryKey: ['admin', 'stats', 'message-rooms', query],
    queryFn: () =>
      apiClient.get<{ rooms: { actorId: string; messages: number; fanReplies: number }[]; totals: { messages: number; fanReplies: number } }>(
        `/admin/stats/message-rooms?${query}`,
      ),
    enabled: !!selection,
  });
}

export function useAdminStatsBreakdown() {
  return useQuery({
    queryKey: ['admin', 'stats', 'breakdown'],
    queryFn: () => apiClient.get<AdminStatsBreakdown>('/admin/stats/breakdown'),
  });
}

// ── 묶음 상품(2026-09-29) ──

export interface AdminBundle extends Bundle {
  storeProductId: string | null;
  active: boolean;
  createdAt: string;
  /** 지금 이 묶음을 구독 중인 팬 수 — 있으면 배우 구성을 못 바꿈 */
  activePurchaseCount: number;
  /** 묶음 자체의 공개 시각(2026-10-19) — 실제로 열리는 시각은 opensAt(든 방 중 더 늦은 게 있으면 그것) */
  releaseAt: string | null;
  releaseWatchCount: number;
  /** 스토어 구독 그룹(2026-10-22 같은 CP 묶음 갈아타기) — 같은 CP방이 든 묶음끼리 한 그룹. 1단계 = 전체(위), 2단계 = 일부. 없으면 그룹 없음 */
  storeGroup: { roomId: string; roomName: string; level: 1 | 2 } | null;
}

/** 묶음 목록·상세에 보이는 스토어 구독 그룹 한 줄 */
export function storeGroupText(group: AdminBundle['storeGroup']): string {
  return group ? `스토어 구독 그룹 "${group.roomName}" · ${group.level}단계${group.level === 1 ? '(위 — 전체)' : '(일부)'}` : '스토어 구독 그룹 없음(CP방이 든 묶음이 아님)';
}

export interface BundleInput {
  name?: string;
  priceCents?: number;
  actorIds?: string[];
  storeProductId?: string | null;
  active?: boolean;
  releaseAt?: string | null;
}

export function useAdminBundles() {
  return useQuery({ queryKey: ['admin', 'bundles'], queryFn: () => apiClient.get<AdminBundle[]>('/admin/bundles') });
}

export function useAdminBundle(id: string) {
  return useQuery({ queryKey: ['admin', 'bundles', id], queryFn: () => apiClient.get<AdminBundle>(`/admin/bundles/${id}`), enabled: !!id });
}

function useBundleMutation<TInput>(request: (input: TInput) => Promise<AdminBundle>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'bundles'] });
      void queryClient.invalidateQueries({ queryKey: ['bundles'] });
    },
  });
}

export function useCreateBundle() {
  return useBundleMutation((input: Required<Pick<BundleInput, 'name' | 'priceCents' | 'actorIds'>> & BundleInput) =>
    apiClient.post<AdminBundle>('/admin/bundles', input),
  );
}

export function useUpdateBundle(id: string) {
  return useBundleMutation((input: BundleInput) => apiClient.patch<AdminBundle>(`/admin/bundles/${id}`, input));
}

// ── 커플방(2026-09-29) ──

/** 운영자 환불 요청 목록(2026-09-29) — 스타 미발송·활동 종료 */
export interface AdminRefundEntry {
  id: string;
  reason: 'STAR_IDLE' | 'ACTOR_RETIRED';
  source: 'SANDBOX' | 'APPLE' | 'GOOGLE';
  /** REFUNDED = 우리가 환불까지, STORE_GUIDED = 애플 환불 페이지 안내(애플이 환불하면 refundedAt이 채워짐) */
  status: 'REFUNDED' | 'STORE_GUIDED';
  requestedAt: string;
  fan: { id: string; name: string; email: string | null } | null;
  productName: string;
  amountCents: number;
  chargedAt: string;
  periodEnd: string;
  refundedAt: string | null;
  actors: string[];
  agencies: (string | null)[];
}

export function useAdminRefunds(reason?: AdminRefundEntry['reason']) {
  return useQuery({
    queryKey: ['admin', 'refunds', reason ?? null],
    queryFn: () => apiClient.get<AdminRefundEntry[]>(`/admin/refunds${reason ? `?reason=${reason}` : ''}`),
  });
}

// 데모 초기화(2026-10-01) — 데모 서버에서만 enabled. 초기화 뒤엔 모든 화면 데이터가 바뀌므로 캐시 전체를 다시 불러옴
export function useDemoStatus() {
  return useQuery({
    queryKey: ['admin', 'demo'],
    queryFn: () => apiClient.get<{ enabled: boolean }>('/admin/demo'),
    staleTime: Infinity,
  });
}

export function useResetDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/admin/demo/reset'),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// 소속사별 데모 입장 코드(2026-10-19) — 코드 하나로 데모의 소속사·아티스트·팬 버튼을 다 씀, 들어오면 운영자에게 메일
export type DemoRoleKey = 'agency' | 'artist' | 'fan' | 'other';

export interface DemoCodeSummary {
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  /** 30분 넘게 쉬었다가 새로 들어온 횟수(= 알림 메일 수) */
  visitCount: number;
  /** 역할별 횟수(로그인 + 새 접속) */
  roleCounts: Partial<Record<DemoRoleKey, number>>;
}

export interface DemoCode extends DemoCodeSummary {
  id: string;
  agencyName: string;
  code: string;
  expiresAt: string;
  revokedAt: string | null;
  note: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
}

export interface DemoAccessEvent {
  id: string;
  role: DemoRoleKey;
  kind: 'LOGIN' | 'VISIT';
  newVisit: boolean;
  platform: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  ip: string | null;
  createdAt: string;
}

export function useDemoCodes() {
  return useQuery({
    queryKey: ['admin', 'demo-codes'],
    queryFn: () => apiClient.get<{ codes: DemoCode[]; common: DemoCodeSummary | null }>('/admin/demo-codes'),
    // 소속사가 들어왔는지 보는 화면이라 다시 열 때마다 새로
    refetchOnMount: 'always',
  });
}

export function useCreateDemoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { agencyName: string; code?: string; expiresAt: string; note?: string }) =>
      apiClient.post<DemoCode>('/admin/demo-codes', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'demo-codes'] }),
  });
}

export function useUpdateDemoCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; agencyName?: string; expiresAt?: string; note?: string | null; revoked?: boolean }) =>
      apiClient.patch<DemoCode>(`/admin/demo-codes/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'demo-codes'] }),
  });
}

/** 코드는 그대로 두고 접속 기록·첫 접속·방문 횟수만 지움(2026-10-25) */
export function useResetDemoCodeStats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ ok: true }>(`/admin/demo-codes/${id}/reset-stats`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'demo-codes'] }),
  });
}

/** id 자리에 'common'이면 공용 코드(내부) 기록 */
export function useDemoCodeEvents(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'demo-codes', id, 'events'],
    queryFn: () => apiClient.get<DemoAccessEvent[]>(`/admin/demo-codes/${id}/events`),
    enabled,
  });
}

// 공지사항(2026-10-12) — 목록은 팬 화면과 같은 GET /notices
export interface NoticeInput {
  title: string;
  body: string;
  pinned: boolean;
  /** 모두에게 푸시(한 공지에 한 번, 2026-10-20) */
  push?: boolean;
}

export function useSaveNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: NoticeInput & { id?: string }) =>
      id ? apiClient.patch(`/admin/notices/${id}`, input) : apiClient.post('/admin/notices', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });
}

export function useDeleteNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/notices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });
}

// ── 활동 종료 때 애플 판매 중지 할 일(2026-10-20) — 구글은 서버가 자동 해지 ──

export interface AppleStoreTodo {
  actors: { id: string; legalName: string; storeProductId: string; retiredAt: string | null; retireAt: string | null }[];
  bundles: { id: string; name: string; storeProductId: string }[];
}

export function useAppleStoreTodo() {
  return useQuery({ queryKey: ['admin', 'store', 'apple-todo'], queryFn: () => apiClient.get<AppleStoreTodo>('/admin/store/apple-todo') });
}

export function useMarkSaleStopped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: 'actors' | 'bundles'; id: string }) => apiClient.patch(`/admin/store/${kind}/${id}/sale-stopped`, { stopped: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'store'] }),
  });
}

// ── 회원 구독·결제·환불 내역(2026-10-20) ──

export interface AdminUserBilling {
  rooms: { actorId: string; startedAt: string; cancelledAt: string | null; actor: { legalName: string; chatDisplayName: string; kind: 'SOLO' | 'COUPLE' } }[];
  purchases: {
    id: string;
    priceCents: number | null;
    startedAt: string;
    cancelledAt: string | null;
    iapPlatform: 'IOS' | 'ANDROID' | null;
    iapExpiresAt: string | null;
    willRenew: boolean;
    actor: { id: string; legalName: string } | null;
    bundle: { id: string; name: string } | null;
  }[];
  charges: {
    id: string;
    productName: string;
    amountCents: number;
    chargedAt: string;
    periodEnd: string;
    source: 'SANDBOX' | 'APPLE' | 'GOOGLE';
    refundedAt: string | null;
    storeAmountMilli: number | null;
    storeCurrency: string | null;
    /** 2026-10-22 묶음 갈아타기 — 차감(음수)·이월 줄 */
    kind: 'PAYMENT' | 'SWITCH_CREDIT' | 'SWITCH_CARRY';
  }[];
  refunds: { id: string; reason: string; status: string; source: string; createdAt: string; charge: { productName: string; amountCents: number; refundedAt: string | null } }[];
}

export function useAdminUserBilling(id: string) {
  return useQuery({ queryKey: ['admin', 'users', 'one', id, 'billing'], queryFn: () => apiClient.get<AdminUserBilling>(`/admin/users/${id}/billing`), enabled: !!id });
}

// ── 팬 한 명 기준 보기 — 답장·신고·차단·제재(2026-10-22) ──

export interface AdminUserActivity {
  replies: {
    id: string;
    body: string | null;
    mediaType: 'TEXT' | 'PHOTO' | 'AUDIO' | 'VIDEO';
    createdAt: string;
    deletedAt: string | null;
    deletedByAdmin: boolean;
    deletedByStaffId: string | null;
    actor: { id: string; legalName: string; chatDisplayName: string; kind: 'SOLO' | 'COUPLE' };
    reportCount: number;
  }[];
  reportsReceived: {
    id: string;
    category: SanctionCategory;
    reason: string | null;
    status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
    createdAt: string;
    resolvedAt: string | null;
    message: { id: string; body: string | null; actor: { legalName: string } };
  }[];
  reportsFiled: {
    id: string;
    category: SanctionCategory;
    reason: string | null;
    status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
    createdAt: string;
    message: { id: string; senderType: 'ARTIST' | 'FAN'; body: string | null; actor: { legalName: string } };
  }[];
  blocks: {
    id: string;
    reason: string | null;
    createdAt: string;
    actor: { id: string; legalName: string };
    blockedBy: { displayName: string; role: AdminUser['role'] };
    message: { body: string | null; createdAt: string } | null;
  }[];
  actions: { id: string; action: string; detail: Record<string, unknown> | null; createdAt: string; admin: { displayName: string } }[];
}

export function useAdminUserActivity(id: string) {
  return useQuery({ queryKey: ['admin', 'users', 'one', id, 'activity'], queryFn: () => apiClient.get<AdminUserActivity>(`/admin/users/${id}/activity`), enabled: !!id });
}

// ── 앱 설정(점검 모드·최소 버전, 2026-10-20) ──

export interface AdminAppSettings {
  maintenanceOn: boolean;
  maintenanceMessage: string | null;
  maintenanceUntil: string | null;
  minVersionIos: string | null;
  minVersionAndroid: string | null;
  updatedAt: string;
}

export function useAdminAppSettings() {
  return useQuery({ queryKey: ['admin', 'app-settings'], queryFn: () => apiClient.get<AdminAppSettings | null>('/admin/app-settings') });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<AdminAppSettings, 'updatedAt'>>) => apiClient.patch<AdminAppSettings>('/admin/app-settings', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'app-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['app-config'] });
    },
  });
}

// ── 1:1 문의(2026-10-20) ──

export type AdminInquiryStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export interface AdminInquiry {
  id: string;
  category: string;
  title: string;
  status: AdminInquiryStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; nickname: string | null; role: AdminUser['role']; email: string | null };
  _count?: { messages: number };
}
export interface AdminInquiryDetail extends AdminInquiry {
  messages: { id: string; fromAdmin: boolean; body: string; createdAt: string; authorId: string; attachments: InquiryPhoto[] }[];
}

/** 상태·종류 필터(종류는 2026-10-25). counts는 고른 종류 안의 상태별, categoryCounts는 고른 상태 안의 종류별 */
export function useAdminInquiries(status?: AdminInquiryStatus, category?: InquiryCategory) {
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}) }).toString();
  return useQuery({
    queryKey: ['admin', 'inquiries', status ?? 'ALL', category ?? 'ALL'],
    queryFn: () =>
      apiClient.get<{ counts: Record<'ALL' | AdminInquiryStatus, number>; categoryCounts: Record<'ALL' | InquiryCategory, number>; items: AdminInquiry[] }>(
        `/admin/inquiries${query ? `?${query}` : ''}`,
      ),
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useAdminInquiry(id: string) {
  return useQuery({ queryKey: ['admin', 'inquiries', 'one', id], queryFn: () => apiClient.get<AdminInquiryDetail>(`/admin/inquiries/${id}`), enabled: !!id });
}

export function useReplyInquiry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photos }: { body: string; photos: PickedPhoto[] }) =>
      apiClient.post<AdminInquiryDetail>(`/admin/inquiries/${id}/messages`, { body, photoKeys: await uploadInquiryPhotos(photos) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] }),
  });
}

/** 문의 지우기(2026-10-25) — 사진 파일까지 지움, 작업 기록에 제목이 남음 */
export function useDeleteAdminInquiry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ deleted: boolean }>(`/admin/inquiries/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin', 'inquiries', 'one', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] });
    },
  });
}

export function useCloseInquiry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch<AdminInquiryDetail>(`/admin/inquiries/${id}/close`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'inquiries'] }),
  });
}

// ── 보안: 2단계 인증·운영자 권한 단계(2026-10-20) ──

export type AdminLevel = 'OWNER' | 'SUPPORT';

export interface AdminMfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  level: AdminLevel;
}

export interface AdminAccount {
  id: string;
  displayName: string;
  nickname: string | null;
  email: string | null;
  status: string;
  level: AdminLevel;
  mfaEnabled: boolean;
  createdAt: string;
}

export function useAdminMfaStatus() {
  return useQuery({ queryKey: ['admin', 'mfa'], queryFn: () => apiClient.get<AdminMfaStatus>('/admin/mfa') });
}

export function useAdminMfaSetup() {
  return useMutation({ mutationFn: () => apiClient.post<{ secret: string; otpauthUrl: string }>('/admin/mfa/setup') });
}

/** enable·verify·disable — 성공하면 새 로그인 토큰(코드를 확인한 시각이 담김)을 돌려줌 */
export function useAdminMfaAction(action: 'enable' | 'verify' | 'disable') {
  return useMutation({ mutationFn: (code: string) => apiClient.post<{ accessToken: string }>(`/admin/mfa/${action}`, { code }) });
}

export function useAdminAccounts(enabled: boolean) {
  return useQuery({ queryKey: ['admin', 'admins'], queryFn: () => apiClient.get<AdminAccount[]>('/admin/admins'), enabled });
}

export function useSetAdminLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, level }: { id: string; level: AdminLevel }) => apiClient.patch<AdminAccount[]>(`/admin/admins/${id}/level`, { level }),
    onSuccess: (rows) => queryClient.setQueryData(['admin', 'admins'], rows),
  });
}

export function useResetAdminMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<AdminAccount[]>(`/admin/admins/${id}/mfa`),
    onSuccess: (rows) => queryClient.setQueryData(['admin', 'admins'], rows),
  });
}
