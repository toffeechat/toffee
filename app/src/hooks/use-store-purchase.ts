import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { ErrorCode, getAvailablePurchases, useIAP, type Purchase } from 'expo-iap';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useMe } from '@/hooks/use-onboarding';
import type { StoreCheckout, StoreTarget } from './store-purchase-types';

export type { StoreCheckout, StoreTarget } from './store-purchase-types';

/** 구글 묶음 갈아타기 — 이 기기에서 예전 구독을 못 찾음(화면이 안내 문구로 바꿈) */
export const STORE_REPLACE_NOT_FOUND = 'STORE_REPLACE_NOT_FOUND';

// 스토어 영수증 → 서버 확인 요청 본문(iOS는 StoreKit2 서명 트랜잭션, 안드로이드는 purchaseToken + 상품 ID)
function receiptOf(purchase: Purchase) {
  return Platform.OS === 'ios'
    ? { platform: 'IOS' as const, signedTransaction: purchase.purchaseToken ?? '' }
    : { platform: 'ANDROID' as const, productId: purchase.productId, purchaseToken: purchase.purchaseToken ?? '' };
}

/**
 * 스토어 결제(2026-09-29 코드 미리 작성) — 배우·커플방·묶음 공통. 결제창에 우리 사용자 id를 심어서(애플 appAccountToken, 구글
 * obfuscatedAccountId) 서버가 "다른 계정의 영수증"을 거르고 스토어 알림만 와도 누구 결제인지 알게 함. 결제 성공 → 서버 확인
 * (actors|bundles/:id/verify-purchase) → 스토어에 거래 완료(안 하면 구글은 3일 뒤 자동 환불). 앱이 꺼졌다 켜지며 다시 온 거래는
 * 복원 경로로 확인. 스토어 상품 ID가 없거나 웹이면 available=false(화면이 샌드박스 구독으로).
 */
export function useStorePurchase(target: StoreTarget): StoreCheckout {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const pending = useRef<{ resolve: (value: unknown) => void; reject: (error: unknown) => void } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
    void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
    void queryClient.invalidateQueries({ queryKey: ['bundle-switch'] });
  };

  const { connected, requestPurchase, finishTransaction, subscriptions, fetchProducts } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const waiting = pending.current;
      pending.current = null;
      try {
        const body = receiptOf(purchase);
        const result = waiting
          ? await apiClient.post(`/${target.kind === 'actor' ? 'actors' : 'bundles'}/${target.id}/verify-purchase`, body)
          : await apiClient.post('/me/purchases/restore', { items: [body] });
        await finishTransaction({ purchase, isConsumable: false });
        refresh();
        waiting?.resolve(result);
      } catch (error) {
        // 서버 확인 실패면 거래를 끝내지 않음 — 다음에 앱이 켜질 때 스토어가 다시 줘서 재시도됨
        waiting?.reject(error);
      }
    },
    onPurchaseError: (error) => {
      const waiting = pending.current;
      pending.current = null;
      if (error.code === ErrorCode.UserCancelled) waiting?.resolve(null);
      else waiting?.reject(error);
    },
  });

  const available = Platform.OS !== 'web' && connected && !!target.sku && !!me?.id;

  // 스토어 가격(그 나라 통화) — 2026-10-12: 예전엔 늘 운영자가 넣은 바트 가격만 보였음
  const sku = target.sku;
  useEffect(() => {
    if (connected && sku) void fetchProducts({ skus: [sku], type: 'subs' }).catch(() => {});
  }, [connected, sku, fetchProducts]);
  const displayPrice = (sku && subscriptions.find((product) => product.id === sku)?.displayPrice) || null;

  const userId = me?.id;
  const buy = async (options?: { replaceSku?: string | null }) => {
    const sku = target.sku;
    if (!sku || !userId) return null;
    // 구글 묶음 갈아타기(2026-10-22) — 이 기기의 예전 구독 토큰을 넘겨야 새 구매가 예전 구매를 대신함(안 넘기면 두 번 결제). 남은 기간은 새 묶음
    // 날수로 환산(with-time-proration — 서버 정산도 이 방식을 전제). 이 기기에 예전 구매가 없으면(다른 구글 계정 등) 진행하지 않음
    let replace: { purchaseToken: string; subscriptionProductReplacementParams: { oldProductId: string; replacementMode: 'with-time-proration' } } | undefined;
    if (options?.replaceSku && Platform.OS === 'android') {
      const owned = (await getAvailablePurchases()).find((purchase) => purchase.productId === options.replaceSku && purchase.purchaseToken);
      if (!owned) throw new Error(STORE_REPLACE_NOT_FOUND);
      replace = { purchaseToken: owned.purchaseToken!, subscriptionProductReplacementParams: { oldProductId: options.replaceSku, replacementMode: 'with-time-proration' } };
    }
    return new Promise((resolve, reject) => {
      pending.current = { resolve, reject };
      requestPurchase({
        request: { apple: { sku, appAccountToken: userId }, google: { skus: [sku], obfuscatedAccountId: userId, ...replace } },
        type: 'subs',
      }).catch((error: unknown) => {
        pending.current = null;
        reject(error);
      });
    });
  };

  const restore = async () => {
    const purchases = await getAvailablePurchases();
    if (!purchases?.length) return 0;
    const { results } = await apiClient.post<{ results: { restored: boolean }[] }>('/me/purchases/restore', {
      items: purchases.map(receiptOf),
    });
    refresh();
    return results.filter((item) => item.restored).length;
  };

  return { available, displayPrice, buy, restore };
}
