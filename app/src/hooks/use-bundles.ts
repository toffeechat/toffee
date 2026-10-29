import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

/**
 * 묶음 구독(2026-09-29) — 여러 배우 개인방을 할인가로 한 번에. 스토어엔 상품 하나, 사면 포함된 방이 모두 열림.
 * 이미 개인 구독 중인 배우가 들어 있으면 그 방은 묶음으로 옮겨지고 대화는 그대로 이어짐.
 */
export interface BundleActor {
  id: string;
  legalName: string;
  chatDisplayName: string;
  officialProfileImageUrl: string | null;
  chatProfileImageUrl: string | null;
  monthlyPriceCents: number;
  retiredAt: string | null;
}

export interface Bundle {
  id: string;
  name: string;
  priceCents: number;
  /** 포함된 배우를 개인 구독으로 따로 살 때 합계 — "N% 할인" 표시용 */
  regularPriceCents: number;
  /** 스토어 구독 상품 ID — 없으면 아직 스토어 결제 불가(샌드박스 구독만) */
  storeProductId?: string | null;
  actors: BundleActor[];
  /** 실제로 열리는 시각(2026-10-19) — 묶음과 든 방의 공개 시각 중 가장 늦은 것, 미래면 "곧 공개"(없으면 바로) */
  opensAt?: string | null;
}

export interface MyBundle {
  purchaseId: string;
  startedAt: string;
  iapPlatform: 'IOS' | 'ANDROID' | null;
  bundle: { id: string; name: string; priceCents: number; actors: Pick<BundleActor, 'id' | 'chatDisplayName' | 'chatProfileImageUrl' | 'monthlyPriceCents'>[] };
}

/** 이 배우가 들어 있는 판매 중인 묶음(배우 프로필) */
export function useActorBundles(actorId: string) {
  return useQuery({
    queryKey: ['bundles', 'actor', actorId],
    queryFn: () => apiClient.get<Bundle[]>(`/actors/${actorId}/bundles`),
    enabled: !!actorId,
  });
}

export function useBundle(id: string) {
  return useQuery({ queryKey: ['bundles', id], queryFn: () => apiClient.get<Bundle>(`/bundles/${id}`), enabled: !!id });
}

export function useMyBundles() {
  const { token } = useAuth();
  return useQuery({ queryKey: ['my-bundles'], queryFn: () => apiClient.get<MyBundle[]>('/me/bundles'), enabled: !!token });
}

// 결제 없는 테스트 구독(서버가 켜 둔 경우만) — 실제 결제 작업 때 스토어 구매로 교체
export function useSubscribeBundle(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ actorIds: string[]; replacedActorIds: string[] }>(`/bundles/${bundleId}/subscribe`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
    },
  });
}

/** 같은 CP 묶음 갈아타기(2026-10-22) — 이 묶음과 같은 CP의 묶음을 이미 갖고 있으면 그 묶음과 바뀌는 시점(없으면 null) */
export interface BundleSwitchInfo {
  purchaseId: string;
  bundle: { id: string; name: string; storeProductId: string | null };
  /** 지금 묶음을 산 곳 — null이면 결제 없는 테스트 구독 */
  platform: 'IOS' | 'ANDROID' | null;
  timing: 'now' | 'next-renewal';
  renewsAt: string | null;
}

export function useBundleSwitchInfo(bundleId: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['bundle-switch', bundleId],
    // 바꿀 묶음이 없으면 서버가 null(빈 본문) — undefined면 react-query가 오류로 처리해서 null로 맞춤
    queryFn: async () => (await apiClient.get<BundleSwitchInfo | null>(`/bundles/${bundleId}/switch-from`)) ?? null,
    enabled: !!token && !!bundleId,
  });
}

/** 테스트 구독 묶음 바꾸기(결제 없음) — 스토어 구독은 스토어 결제창으로 */
export function useSwitchBundle(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(`/bundles/${bundleId}/switch`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
      void queryClient.invalidateQueries({ queryKey: ['bundle-switch'] });
    },
  });
}

/** 구매 하나 해지 — 묶음 해지(포함된 방 중 다른 구독이 없는 방이 닫힘) */
export function useCancelPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (purchaseId: string) => apiClient.delete(`/me/purchases/${purchaseId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
    },
  });
}

/** 개인 구독 합계 대비 할인율(%) — 0 이하면 표시 안 함 */
export function bundleDiscountPercent(bundle: Pick<Bundle, 'priceCents' | 'regularPriceCents'>): number {
  if (bundle.regularPriceCents <= 0) return 0;
  return Math.round((1 - bundle.priceCents / bundle.regularPriceCents) * 100);
}
