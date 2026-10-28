import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from '@apple/app-store-server-library';
import { appError } from '../common/i18n/app-error.js';
import { addMonths } from '../settlements/allocate-charge.js';

// Apple이 공개하는 루트 인증서 — StoreKit2 JWS(서명된 트랜잭션·서버 알림) 검증에 필요.
// 자주 안 바뀌는 값이라 프로세스 실행 중엔 한 번만 받아서 메모리에 캐싱(받기에 실패하면 캐싱하지 않고 다음 호출에서 다시, 2026-10-27).
const APPLE_ROOT_CA_URL = 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer';

/** 스토어가 확인해 준 구독 결제 한 건(애플·구글 공통 모양) */
export interface StoreTransaction {
  platform: 'IOS' | 'ANDROID';
  // 구독 인스턴스 식별자 = Purchase.iapTransactionId(애플 originalTransactionId, 구글 purchaseToken) — 갱신돼도 그대로
  originalTransactionId: string;
  // 결제 1건 식별자(애플 transactionId, 구글 orderId — 갱신마다 새로 생김) = PurchaseCharge.storeTransactionId
  storeTransactionId?: string;
  productId: string;
  // 이 결제 시각(애플 purchaseDate, 구글은 첫 결제만 startTime — 갱신 알림에선 알림 받은 시각)
  purchasedAt: Date;
  expiresAt: Date;
  // 결제할 때 앱이 넣어 준 우리 사용자 id(애플 appAccountToken, 구글 obfuscatedExternalAccountId) — 다른 계정의 영수증 방지·알림으로 사용자 찾기
  accountToken?: string;
  storeAmountMilli?: number;
  storeCurrency?: string;
  // 스토어 자동 갱신 상태(2026-10-02) — 구글 API의 autoRenewing, 애플 알림의 갱신 정보(autoRenewStatus). 모르면 비움(앱의 영수증 확인 등)
  willRenew?: boolean;
  // 같은 CP 묶음 갈아타기(2026-10-22) — 구글은 바꾸면 새 구매(새 purchaseToken)가 생기고 예전 구매를 가리킴(linkedPurchaseToken). 애플은 같은
  // originalTransactionId에서 상품만 바뀌어서 없음
  replacesTransactionId?: string;
  // 구글: 이 구매가 다른 구매로 교체돼 끝남(cancelReason 2) — 이 토큰의 만료 알림으로 방을 닫으면 안 됨(새 구매가 이어받음)
  replaced?: boolean;
  // 테스트 결제(2026-10-27) — 애플 샌드박스(앱 심사·TestFlight)·구글 라이선스 테스터. 이용은 열어 주되 결제 기록은 SANDBOX(정산 제외)
  sandbox?: boolean;
  // 애플: 환불·취소된 결제(revocationDate) — 앱이 저장해 둔 영수증을 다시 보내도 방을 열지 않음(2026-10-27)
  revoked?: boolean;
  // 구글: 결제 대기(paymentState 0, 편의점·현금 결제 등) — 결제가 끝나기 전엔 방을 열지 않음(2026-10-27)
  pending?: boolean;
  // 구글: 아직 확인(acknowledge) 안 된 구매 — 3일 안에 확인 안 하면 구글이 자동 환불해서 서버가 확인해 줌(2026-10-27)
  needsAcknowledge?: boolean;
  // 결제 실패(유예 끝·결제 보류) 뒤 같은 스토어 구독이 회복됨(애플 DID_RENEW/BILLING_RECOVERY, 구글 RECOVERED) — 재구독이 아니라 대화 이어 보기(2026-10-27)
  recovered?: boolean;
}

/** 애플 서버 알림(App Store Server Notifications V2)을 검증·해석한 결과 */
export interface AppleNotification {
  type: string;
  subtype?: string;
  transaction?: StoreTransaction;
  // 결제 실패 후 유예 기간이 켜져 있으면 그 끝(이때까지는 이용 유지)
  gracePeriodExpiresAt?: Date;
}

interface GooglePlaySubscriptionResponse {
  orderId?: string;
  startTimeMillis?: string;
  expiryTimeMillis: string;
  priceAmountMicros?: string;
  priceCurrencyCode?: string;
  obfuscatedExternalAccountId?: string;
  autoRenewing?: boolean;
  linkedPurchaseToken?: string;
  // 0 팬 해지, 1 시스템(결제 실패 등), 2 다른 구독으로 교체, 3 개발자 해지
  cancelReason?: number;
  // 0 결제 대기, 1 결제됨, 2 무료 체험, 3 업·다운그레이드 대기(만료된 구독엔 없음)
  paymentState?: number;
  // 0 아직 확인 안 됨, 1 확인됨
  acknowledgementState?: number;
  // 0 테스트(라이선스 테스터), 1 프로모션, 2 보상형 — 실제 결제면 없음
  purchaseType?: number;
}

/**
 * 스토어 영수증·알림 검증(2026-09-18 스캐폴딩, 2026-09-29 보강). 스토어 계정·상품 등록 전엔 설정값이 없어서 호출하면 실패함 —
 * App Store Connect/Play Console 설정을 넣으면 그대로 동작하게 짜 둠. 필요한 설정: `docs/product/ops-infra-backlog.md`.
 */
@Injectable()
export class IapVerificationService {
  private readonly logger = new Logger(IapVerificationService.name);
  private cachedAppleRootCertificate: Buffer | null = null;
  private appleVerifiers: SignedDataVerifier[] | null = null;
  private readonly pubSubClient = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  // 운영(PRODUCTION) 환경 검증엔 앱의 Apple ID(숫자, App Store Connect "일반 정보")가 꼭 필요 — 예전 코드는 빠져 있어서 운영에서 검증이 실패했을 것
  // 스토어 설정이 아직 없으면 500 대신 503(스토어 결제 준비 전) — 검증을 그냥 통과시키진 않음
  private required(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new ServiceUnavailableException(appError('SERVICE_UNAVAILABLE'));
    return value;
  }

  /**
   * 애플 검증기 — 운영 먼저, 환경이 안 맞으면 샌드박스로(2026-10-27). 앱 심사·TestFlight 결제는 운영 앱에서도 샌드박스라, 운영 검증기만 쓰면
   * 심사원이 구독을 못 함(애플 권장 방식). APPLE_IAP_ENVIRONMENT=SANDBOX(개발)면 샌드박스만. 루트 인증서를 받은 뒤에만 캐싱.
   */
  private async getAppleVerifiers(): Promise<SignedDataVerifier[]> {
    if (this.appleVerifiers) return this.appleVerifiers;
    const bundleId = this.required('APPLE_BUNDLE_ID');
    const sandboxOnly = this.configService.get<string>('APPLE_IAP_ENVIRONMENT') === 'SANDBOX';
    const roots = [await this.getAppleRootCertificate()];
    const sandbox = new SignedDataVerifier(roots, true, Environment.SANDBOX, bundleId);
    this.appleVerifiers = sandboxOnly
      ? [sandbox]
      : [new SignedDataVerifier(roots, true, Environment.PRODUCTION, bundleId, Number(this.required('APPLE_APP_ID'))), sandbox];
    return this.appleVerifiers;
  }

  // 검증기를 차례로 — 환경(또는 운영 앱 id)이 안 맞을 때만 다음 것으로. 서명 자체가 틀리면 바로 실패
  private async withAppleVerifier<T>(run: (verifier: SignedDataVerifier) => Promise<T>): Promise<{ value: T; verifier: SignedDataVerifier }> {
    const verifiers = await this.getAppleVerifiers();
    for (let index = 0; ; index += 1) {
      try {
        return { value: await run(verifiers[index]), verifier: verifiers[index] };
      } catch (error) {
        const mismatch =
          error instanceof VerificationException &&
          (error.status === VerificationStatus.INVALID_ENVIRONMENT || error.status === VerificationStatus.INVALID_APP_IDENTIFIER);
        if (!mismatch || index === verifiers.length - 1) throw error;
      }
    }
  }

  // expo-iap가 iOS에서 주는 건 옛날 방식의 base64 영수증이 아니라 StoreKit2 서명 트랜잭션(JWS 문자열)이라, 애플 공식 라이브러리로
  // 로컬에서 서명을 검증하고 페이로드를 디코딩함(Apple 서버로 verifyReceipt를 호출하는 옛날 방식이 아님).
  async verifyApple(signedTransaction: string): Promise<StoreTransaction> {
    const payload = await this.withAppleVerifier((verifier) => verifier.verifyAndDecodeTransaction(signedTransaction))
      .then((result) => result.value)
      .catch((error: unknown) => {
        // 인증서를 못 받는 등 설정·네트워크 문제는 영수증 탓이 아님 — 그대로(503)
        if (error instanceof ServiceUnavailableException) throw error;
        return null;
      });
    const transaction = payload ? appleTransaction(payload) : null;
    if (!transaction) throw new BadRequestException(appError('IAP_APPLE_VERIFY_FAILED'));
    // 환불·취소된 결제(2026-10-27) — 예전엔 앱에 남은 서명 트랜잭션을 다시 보내면 환불받은 방이 다시 열렸음
    if (transaction.revoked) throw new BadRequestException(appError('IAP_EXPIRED'));
    return transaction;
  }

  /** 애플 서버 알림 — 서명 검증 후 알림 종류와 안에 든 결제·갱신 정보를 풀어 줌 */
  async decodeAppleNotification(signedPayload: string): Promise<AppleNotification> {
    const decoded = await this.withAppleVerifier((verifier) => verifier.verifyAndDecodeNotification(signedPayload)).catch((error: unknown) => {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`애플 알림 검증 실패: ${String(error)}`);
      return null;
    });
    const notification = decoded?.value;
    if (!decoded || !notification?.notificationType) throw new BadRequestException(appError('IAP_APPLE_VERIFY_FAILED'));
    // 안에 든 결제·갱신 정보는 알림을 통과시킨 검증기(같은 환경)로
    const verifier = decoded.verifier;
    const [transactionPayload, renewal] = await Promise.all([
      notification.data?.signedTransactionInfo ? verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo) : null,
      notification.data?.signedRenewalInfo ? verifier.verifyAndDecodeRenewalInfo(notification.data.signedRenewalInfo) : null,
    ]);
    const transaction = (transactionPayload && appleTransaction(transactionPayload)) || undefined;
    // 갱신 정보의 autoRenewStatus: 1 켜짐 / 0 꺼짐(팬이 해지) — 없으면 모름
    const willRenew = renewal?.autoRenewStatus === undefined ? undefined : Number(renewal.autoRenewStatus) === 1;
    return {
      type: String(notification.notificationType),
      subtype: notification.subtype ? String(notification.subtype) : undefined,
      transaction: transaction ? { ...transaction, willRenew } : undefined,
      gracePeriodExpiresAt: renewal?.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate) : undefined,
    };
  }

  private async getAppleRootCertificate(): Promise<Buffer> {
    if (this.cachedAppleRootCertificate) return this.cachedAppleRootCertificate;
    // 실패(네트워크·5xx)를 캐싱하면 서버를 다시 켤 때까지 애플 결제가 전부 실패함 — 성공했을 때만 저장(2026-10-27)
    const res = await fetch(APPLE_ROOT_CA_URL).catch(() => null);
    const body = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (!body || body.length === 0) {
      this.logger.warn(`애플 루트 인증서 받기 실패: ${res ? res.status : 'network'}`);
      throw new ServiceUnavailableException(appError('SERVICE_UNAVAILABLE'));
    }
    this.cachedAppleRootCertificate = body;
    return body;
  }

  async verifyGoogle(purchaseToken: string, productId: string, now = new Date()): Promise<StoreTransaction> {
    const packageName = this.required('GOOGLE_PLAY_PACKAGE_NAME');
    const serviceAccountJson = this.required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');

    const auth = new GoogleAuth({
      credentials: JSON.parse(serviceAccountJson) as Record<string, string>,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;
    if (!accessToken) throw new BadRequestException(appError('IAP_GOOGLE_AUTH_FAILED'));

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new BadRequestException(appError('IAP_GOOGLE_VERIFY_FAILED'));
    return googleTransaction(purchaseToken, productId, (await res.json()) as GooglePlaySubscriptionResponse, now);
  }

  /**
   * 구글 구독 확인(acknowledge, 2026-10-27) — 3일 안에 확인 안 하면 구글이 자동 환불·취소함. 원래 앱이 finishTransaction으로 하지만, 앱이 그 전에
   * 꺼지면 결제한 팬이 환불되고 방이 닫혀서 서버가 결제를 반영한 뒤에도 확인해 줌. 실패해도 경고만(앱·다음 알림이 다시 기회).
   */
  async acknowledgeGoogle(purchaseToken: string, productId: string): Promise<void> {
    try {
      const packageName = this.required('GOOGLE_PLAY_PACKAGE_NAME');
      const auth = new GoogleAuth({
        credentials: JSON.parse(this.required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) as Record<string, string>,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });
      const accessToken = (await (await auth.getClient()).getAccessToken()).token;
      if (!accessToken) throw new Error('google auth failed');
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error(`google acknowledge ${res.status}`);
    } catch (error) {
      this.logger.warn(`구글 구독 확인(acknowledge) 실패: ${String(error)}`);
    }
  }

  /**
   * 구글 결제 한 건(orderId) 환불(2026-09-29, 스타 미발송 환불) — revoke=false라 지금 이용 중인 기간·자동 갱신은 그대로, 그 결제만 돌려줌.
   * 서비스 계정에 Play Console "주문 관리" 권한이 있어야 함.
   */
  async refundGoogleOrder(orderId: string): Promise<void> {
    const packageName = this.required('GOOGLE_PLAY_PACKAGE_NAME');
    const auth = new GoogleAuth({
      credentials: JSON.parse(this.required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) as Record<string, string>,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const accessToken = (await (await auth.getClient()).getAccessToken()).token;
    if (!accessToken) throw new BadRequestException(appError('IAP_GOOGLE_AUTH_FAILED'));
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/orders/${encodeURIComponent(orderId)}:refund?revoke=false`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new BadRequestException(appError('REFUND_FAILED'));
  }

  /**
   * 구글 구독 자동 갱신 해지(2026-10-20, 아티스트 활동 종료) — subscriptionsv2.cancel. 이미 낸 기간(만료 시각)까지는 이용하고 다음 결제만 안 됨.
   * 설정(GOOGLE_PLAY_*)이 없으면 false(개발·데모). 실패하면 예외 — 부르는 쪽이 다음에 다시 시도.
   */
  async cancelGoogleSubscription(purchaseToken: string): Promise<boolean> {
    const packageName = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    const serviceAccountJson = this.configService.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (!packageName || !serviceAccountJson) return false;
    const auth = new GoogleAuth({ credentials: JSON.parse(serviceAccountJson) as Record<string, string>, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
    const accessToken = (await (await auth.getClient()).getAccessToken()).token;
    if (!accessToken) throw new Error('google auth failed');
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}:cancel`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancellationContext: { cancellationType: 'DEVELOPER_REQUESTED_STOP_PAYMENTS' } }),
    });
    if (!res.ok) throw new Error(`google cancel ${res.status}`);
    return true;
  }

  /**
   * 구글 실시간 개발자 알림(RTDN)은 Pub/Sub "푸시"로 옴 — 요청의 Authorization: Bearer <OIDC 토큰>이 우리가 지정한 서비스 계정이
   * 서명한 것인지 확인(아무나 가짜 "갱신됨" 알림을 보내지 못하게). 설정이 없으면 이 경로를 닫아 둠(404).
   */
  async verifyPubSubPush(authorization: string | undefined): Promise<void> {
    const audience = this.configService.get<string>('GOOGLE_RTDN_AUDIENCE');
    const serviceAccount = this.configService.get<string>('GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL');
    if (!audience || !serviceAccount) throw new NotFoundException();
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw new UnauthorizedException();
    const ticket = await this.pubSubClient.verifyIdToken({ idToken: token, audience }).catch(() => null);
    const payload = ticket?.getPayload();
    if (!payload || payload.email !== serviceAccount || payload.email_verified !== true) throw new UnauthorizedException();
  }
}

export function appleTransaction(payload: {
  originalTransactionId?: string;
  transactionId?: string;
  productId?: string;
  purchaseDate?: number;
  expiresDate?: number;
  appAccountToken?: string;
  price?: number;
  currency?: string;
  revocationDate?: number;
  environment?: string;
}): StoreTransaction | null {
  if (!payload.originalTransactionId || !payload.expiresDate || !payload.productId) return null;
  return {
    platform: 'IOS',
    originalTransactionId: payload.originalTransactionId,
    storeTransactionId: payload.transactionId,
    productId: payload.productId,
    purchasedAt: new Date(payload.purchaseDate ?? Date.now()),
    expiresAt: new Date(payload.expiresDate),
    accountToken: payload.appAccountToken || undefined,
    storeAmountMilli: payload.price,
    storeCurrency: payload.currency,
    // 운영 환경이 아닌 결제(Sandbox·Xcode) — 정산 제외
    ...(payload.environment && payload.environment !== String(Environment.PRODUCTION) ? { sandbox: true } : {}),
    ...(payload.revocationDate ? { revoked: true } : {}),
  };
}

// 구글 orderId는 첫 결제 "GPA.1234-...", 갱신마다 뒤에 "..0", "..1"이 붙음 — 갱신이면 결제 시각을 따로 안 주므로 만료일 한 달 전(월 구독)으로
// 추정하되 지금보다 늦으면 지금. 예전엔 늘 지금 시각이라, 알림을 놓쳐 며칠 뒤 복원으로 처음 기록되면 정산 달·이용 기간이 틀어졌음(2026-10-28 점검)
export function googleTransaction(purchaseToken: string, productId: string, body: GooglePlaySubscriptionResponse, now: Date): StoreTransaction {
  const renewal = !!body.orderId && /\.\.\d+$/.test(body.orderId);
  const renewedAt = addMonths(new Date(Number(body.expiryTimeMillis)), -1);
  return {
    platform: 'ANDROID',
    originalTransactionId: purchaseToken,
    storeTransactionId: body.orderId,
    productId,
    purchasedAt: !renewal && body.startTimeMillis ? new Date(Number(body.startTimeMillis)) : renewal && renewedAt < now ? renewedAt : now,
    expiresAt: new Date(Number(body.expiryTimeMillis)),
    accountToken: body.obfuscatedExternalAccountId || undefined,
    storeAmountMilli: body.priceAmountMicros ? Math.round(Number(body.priceAmountMicros) / 1000) : undefined,
    storeCurrency: body.priceCurrencyCode,
    willRenew: body.autoRenewing,
    replacesTransactionId: body.linkedPurchaseToken || undefined,
    replaced: body.cancelReason === 2 || undefined,
    sandbox: body.purchaseType === 0 || undefined,
    pending: body.paymentState === 0 || undefined,
    needsAcknowledge: body.acknowledgementState === 0 || undefined,
  };
}
