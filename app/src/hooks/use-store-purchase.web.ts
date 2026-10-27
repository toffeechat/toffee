import type { StoreCheckout, StoreTarget } from './store-purchase-types';

export type { StoreCheckout, StoreTarget } from './store-purchase-types';

export const STORE_REPLACE_NOT_FOUND = 'STORE_REPLACE_NOT_FOUND';
export const STORE_PURCHASE_PENDING = 'STORE_PURCHASE_PENDING';

/** 웹엔 스토어 결제가 없어서 앱 전체 결제 처리도 없음 */
export function useStorePurchaseSync(): void {}

/** 웹엔 스토어 결제가 없음(앱에서만 구독 결제 — 스토어 정책). 화면은 샌드박스 구독(개발) 또는 "앱에서 구독" 안내 */
export function useStorePurchase(_target: StoreTarget): StoreCheckout {
  return { available: false, displayPrice: null, buy: async () => null, restore: async () => 0 };
}
