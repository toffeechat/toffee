/** 스토어 결제 공통 타입 — 앱(use-store-purchase.ts)·웹(use-store-purchase.web.ts) */
export type StoreTarget = { kind: 'actor' | 'bundle'; id: string; sku: string | null | undefined };

export interface StoreCheckout {
  /** 이 기기에서 실제 스토어 결제를 쓸 수 있는지(앱 + 스토어 연결됨 + 상품 ID 있음). 아니면 화면이 결제 없는 테스트 구독으로 */
  available: boolean;
  /** 스토어 결제창 → 서버 확인까지. 사용자가 닫으면 null */
  buy: () => Promise<unknown>;
  /** 스토어가 이 기기 나라 통화로 준 가격(예: "₩4,400") — 실제 청구 금액이라 결제 화면에선 이걸 우선 표시. 아직 못 받았거나 웹이면 null */
  displayPrice: string | null;
  /** 구매 복원 — 복원된 개수 */
  restore: () => Promise<number>;
}
