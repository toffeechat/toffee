import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMe } from '@/hooks/use-onboarding';
import type { StoreCheckout, StoreTarget } from './store-purchase-types';

export type { StoreCheckout, StoreTarget } from './store-purchase-types';

/** 구글 묶음 갈아타기 — 이 기기에서 예전 구독을 못 찾음(화면이 안내 문구로 바꿈) */
export const STORE_REPLACE_NOT_FOUND = 'STORE_REPLACE_NOT_FOUND';
/** 결제 대기(안드로이드 현금·편의점 결제 등, 2026-10-27) — buy()가 이 값으로 끝나면 화면이 "결제가 끝나면 자동으로 열려요" 안내 */
export const STORE_PURCHASE_PENDING = 'STORE_PURCHASE_PENDING';

// 스토어 영수증 → 서버 확인 요청 본문(iOS는 StoreKit2 서명 트랜잭션, 안드로이드는 purchaseToken + 상품 ID)
function receiptOf(purchase: Purchase) {
  return Platform.OS === 'ios'
    ? { platform: 'IOS' as const, signedTransaction: purchase.purchaseToken ?? '' }
    : { platform: 'ANDROID' as const, productId: purchase.productId, purchaseToken: purchase.purchaseToken ?? '' };
}

/*
 * 스토어 결제 처리는 앱 전체에 하나(2026-10-27) — 예전엔 결제 화면마다 useIAP가 따로 듣고 있어서 ① 결제·구독 관리 화면이 떠 있을 때만
 * 거래를 처리했고(나가 있으면 구글은 3일 뒤 자동 환불) ② 화면이 둘 이상 떠 있으면 같은 거래를 두 번 처리했고 ③ 화면을 닫으면 useIAP가
 * 스토어 연결 자체를 끊었음. 이제 연결·듣기는 이 모듈이 한 번만 하고(_layout SessionEffects의 useStorePurchaseSync), 결제 화면은
 * 상품 ID별로 결과만 기다림. 로그인·앱으로 돌아올 때 스토어의 남은 거래를 복원 경로로 확인해 거래 완료까지 함.
 */
type Waiter = { target: StoreTarget; resolve: (value: unknown) => void; reject: (error: unknown) => void };
const waiters = new Map<string, Waiter>();
// 처리 중인 거래(같은 거래가 이벤트·복원으로 겹쳐 와도 한 번만)
const handling = new Set<string>();
let currentUserId: string | null = null;
let refresh: () => void = () => {};
let connection: Promise<boolean> | null = null;
let listenersAttached = false;
let connected = false;
const connectedListeners = new Set<() => void>();
let syncing = false;
let lastSyncAt = 0;
// 앱으로 돌아올 때마다 서버에 묻지 않게 — 이 간격 안에서는 건너뜀
const SYNC_GAP_MS = 10 * 60_000;

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  connectedListeners.forEach((listener) => listener());
}
function subscribeConnected(listener: () => void) {
  connectedListeners.add(listener);
  return () => connectedListeners.delete(listener);
}

const purchaseKey = (purchase: Purchase) => `${purchase.productId}:${purchase.purchaseToken ?? purchase.transactionId ?? purchase.id}`;
const isAcknowledged = (purchase: Purchase) => 'isAcknowledgedAndroid' in purchase && purchase.isAcknowledgedAndroid === true;

// 거래 완료(안 하면 구글은 3일 뒤 자동 환불) — 실패해도 결과는 그대로(다음 확인 때 다시 시도)
async function finish(purchase: Purchase) {
  await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
}

async function handlePurchase(purchase: Purchase) {
  if (!purchase.productId) return;
  const waiter = waiters.get(purchase.productId);
  // 결제 대기 — 아직 돈이 안 들어옴. 서버 확인·거래 완료를 하지 않고 화면엔 "대기 중"으로. 결제가 끝나면 스토어가 purchased로 다시 줌
  if (purchase.purchaseState === 'pending') {
    if (waiter) {
      waiters.delete(purchase.productId);
      waiter.resolve(STORE_PURCHASE_PENDING);
    }
    return;
  }
  // 로그아웃 상태 — 다음 로그인 때 복원 확인이 처리. 결제 화면이 기다리는 거래는 팬이 아닌 계정(다른 방을 구독한 아티스트·소속사)이어도 처리
  if (!currentUserId && !waiter) return;
  const key = purchaseKey(purchase);
  if (handling.has(key)) return;
  handling.add(key);
  if (waiter) waiters.delete(purchase.productId);
  try {
    const body = receiptOf(purchase);
    let result: unknown;
    if (waiter) {
      const { kind, id } = waiter.target;
      result = await apiClient.post(`/${kind === 'actor' ? 'actors' : 'bundles'}/${id}/verify-purchase`, body);
    } else {
      // 화면이 기다리지 않는 거래(대기였다가 끝난 결제·앱이 꺼졌다 켜지며 다시 온 거래) — 복원 경로로 확인
      const { results } = await apiClient.post<{ results: { restored: boolean }[] }>('/me/purchases/restore', { items: [body] });
      // 서버가 안 받아 주면 거래를 끝내지 않음 — 다음에 다시 시도
      if (!results[0]?.restored) return;
      result = results[0];
    }
    await finish(purchase);
    refresh();
    waiter?.resolve(result);
  } catch (error) {
    // 서버 확인 실패면 거래를 끝내지 않음 — 다음에 앱이 켜질 때 스토어가 다시 줘서 재시도됨
    waiter?.reject(error);
  } finally {
    handling.delete(key);
  }
}

type StorePurchaseError = Parameters<Parameters<typeof purchaseErrorListener>[0]>[0];

function handlePurchaseError(error: StorePurchaseError) {
  if (!connected && error.code === ErrorCode.InitConnection) return;
  // 어느 상품의 오류인지 모르면 기다리는 화면 전부에(보통 하나)
  const skus = error.productId && waiters.has(error.productId) ? [error.productId] : [...waiters.keys()];
  for (const sku of skus) {
    const waiter = waiters.get(sku);
    waiters.delete(sku);
    if (error.code === ErrorCode.UserCancelled) waiter?.resolve(null);
    else waiter?.reject(error);
  }
}

// 스토어 연결(앱 전체에 한 번) — 실패하면 다음 호출 때 다시
function ensureConnection(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  if (!listenersAttached) {
    // 연결 직후 바로 오는 거래(iOS 미완료 거래 등)를 놓치지 않게 연결 전에 등록
    listenersAttached = true;
    purchaseUpdatedListener((purchase) => void handlePurchase(purchase));
    purchaseErrorListener(handlePurchaseError);
  }
  if (!connection) {
    const attempt = initConnection()
      .then((ok) => {
        setConnected(ok);
        if (!ok && connection === attempt) connection = null;
        return ok;
      })
      .catch(() => {
        setConnected(false);
        if (connection === attempt) connection = null;
        return false;
      });
    connection = attempt;
  }
  return connection;
}

const RESTORE_CHUNK = 20;

/** 스토어 거래들을 서버에 복원 요청 → 서버가 받은 것만 거래 완료. 복원된 개수 */
async function restorePurchases(purchases: Purchase[]): Promise<number> {
  // 지금 결제 화면이 기다리거나 처리 중인 거래는 뺌(2026-10-28) — 안드로이드는 결제 창이 닫히며 앱으로 돌아올 때 이 확인이 돌아서
  // 같은 거래를 결제 확인·복원 두 요청이 동시에 보내 한쪽이 실패("결제 실패"로 보임)할 수 있었음
  const usable = purchases.filter(
    (purchase) =>
      purchase.purchaseState !== 'pending' && purchase.purchaseToken && !handling.has(purchaseKey(purchase)) && !waiters.has(purchase.productId),
  );
  if (!usable.length) return 0;
  const keys = usable.map(purchaseKey);
  for (const key of keys) handling.add(key);
  try {
    return await restoreUsable(usable);
  } finally {
    for (const key of keys) handling.delete(key);
  }
}

async function restoreUsable(usable: Purchase[]): Promise<number> {
  // 서버는 한 번에 20개까지 받음(RestorePurchasesDto @ArrayMaxSize) — 거래가 많은 기기(오래 쓴 iOS 등)는 나눠서 보냄(2026-10-28)
  const results: { restored: boolean }[] = [];
  for (let start = 0; start < usable.length; start += RESTORE_CHUNK) {
    const chunk = await apiClient.post<{ results: { restored: boolean }[] }>('/me/purchases/restore', {
      items: usable.slice(start, start + RESTORE_CHUNK).map(receiptOf),
    });
    // 덜 돌아와도 순서가 밀리지 않게 보낸 개수만큼 채움
    const sent = Math.min(RESTORE_CHUNK, usable.length - start);
    for (let index = 0; index < sent; index++) results.push(chunk.results[index] ?? { restored: false });
  }
  // 결과는 보낸 순서 그대로(서버 restorePurchases). 이미 완료된 안드로이드 거래는 다시 완료하지 않음
  await Promise.all(usable.map((purchase, index) => (results[index]?.restored && !isAcknowledged(purchase) ? finish(purchase) : undefined)));
  refresh();
  return results.filter((item) => item.restored).length;
}

// 로그인·앱으로 돌아올 때 남은 거래 확인 — 안드로이드는 아직 완료 안 된 것만(완료된 구독은 서버가 스토어 알림으로 따라감)
async function syncPurchases(force = false) {
  if (!currentUserId || syncing || (!force && Date.now() - lastSyncAt < SYNC_GAP_MS)) return;
  syncing = true;
  lastSyncAt = Date.now();
  try {
    if (!(await ensureConnection())) return;
    const purchases = await getAvailablePurchases();
    await restorePurchases(Platform.OS === 'android' ? purchases.filter((purchase) => !isAcknowledged(purchase)) : purchases);
  } catch {
    // 오프라인 등 — 다음에 다시
  } finally {
    syncing = false;
  }
}

/** 앱 전체 결제 처리 — _layout의 SessionEffects에서 한 번만. 팬(USER)으로 로그인한 동안만 동작(웹은 .web.ts가 비어 있음) */
export function useStorePurchaseSync(): void {
  const queryClient = useQueryClient();
  const { token, role } = useAuth();
  const { data: me } = useMe();
  const userId = token && role === 'USER' ? me?.id : undefined;

  useEffect(() => {
    refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
      void queryClient.invalidateQueries({ queryKey: ['bundle-switch'] });
    };
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;
    currentUserId = userId;
    void syncPurchases(true);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncPurchases();
    });
    return () => {
      appState.remove();
      currentUserId = null;
      lastSyncAt = 0;
      // 로그아웃 — 기다리던 화면은 닫힌 것으로
      waiters.forEach((waiter) => waiter.resolve(null));
      waiters.clear();
    };
  }, [userId]);
}

/**
 * 스토어 결제(2026-09-29 코드 미리 작성) — 배우·커플방·묶음 공통. 결제창에 우리 사용자 id를 심어서(애플 appAccountToken, 구글
 * obfuscatedAccountId) 서버가 "다른 계정의 영수증"을 거르고 스토어 알림만 와도 누구 결제인지 알게 함. 결제 성공 → 서버 확인
 * (actors|bundles/:id/verify-purchase) → 스토어에 거래 완료. 실제 처리는 위의 앱 전체 처리가 하고 이 훅은 결과만 기다림.
 * 스토어 상품 ID가 없거나 웹이면 available=false(화면이 샌드박스 구독으로).
 */
export function useStorePurchase(target: StoreTarget): StoreCheckout {
  const { data: me } = useMe();
  const isConnected = useSyncExternalStore(subscribeConnected, () => connected, () => false);

  useEffect(() => {
    void ensureConnection();
  }, []);

  const available = Platform.OS !== 'web' && isConnected && !!target.sku && !!me?.id;

  // 스토어 가격(그 나라 통화) — 2026-10-12: 예전엔 늘 운영자가 넣은 바트 가격만 보였음
  const sku = target.sku;
  const [price, setPrice] = useState<{ sku: string; displayPrice: string | null } | null>(null);
  useEffect(() => {
    if (!isConnected || !sku) return;
    let alive = true;
    fetchProducts({ skus: [sku], type: 'subs' })
      .then((products) => {
        const product = (products ?? []).find((item) => item.id === sku);
        if (alive) setPrice({ sku, displayPrice: product?.displayPrice ?? null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isConnected, sku]);
  const displayPrice = (sku && price?.sku === sku && price.displayPrice) || null;

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
      // 같은 상품을 기다리던 이전 요청은 닫힌 것으로
      waiters.get(sku)?.resolve(null);
      const waiter: Waiter = { target: { ...target, sku }, resolve, reject };
      waiters.set(sku, waiter);
      requestPurchase({
        request: { apple: { sku, appAccountToken: userId }, google: { skus: [sku], obfuscatedAccountId: userId, ...replace } },
        type: 'subs',
      }).catch((error: unknown) => {
        if (waiters.get(sku) === waiter) waiters.delete(sku);
        reject(error);
      });
    });
  };

  // 구매 복원(구독 관리 화면) — 이 기기의 스토어 거래 전부를 서버에 확인하고, 서버가 받은 것은 거래 완료까지
  const restore = async () => {
    if (!(await ensureConnection())) return 0;
    const purchases = await getAvailablePurchases();
    if (!purchases?.length) return 0;
    return restorePurchases(purchases);
  };

  return { available, displayPrice, buy, restore };
}
