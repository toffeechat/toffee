import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IapVerificationService } from './iap-verification.service.js';
import { ChargeKind, ChargeSource, IapPlatform, MessageSenderType, ParentalConsentStatus, SubscriptionEventType } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { VerifyPurchaseDto } from './dto/verify-purchase.dto.js';
import { MediaService } from '../storage/media.service.js';
import { appError } from '../common/i18n/app-error.js';
import { CURRENT_TERMS_VERSION } from '../common/legal/terms.js';
import { allocateBundlePrice } from './allocate-price.js';
import { roomRetireAt, roomRetired } from '../common/authorization/actor-access.js';
import { bundleOpensAt, isReleased } from '../common/release/release.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ChargeLedgerService, sourceOf } from '../settlements/charge-ledger.service.js';
import { AdminAlertService } from '../notifications/admin-alert.service.js';
import type { StoreTransaction } from './iap-verification.service.js';
import { Cron, CronExpression } from '../common/lifecycle/cron.js';
import { ConfigService } from '@nestjs/config';
import { storeGroupOf, switchTiming, type GroupActor } from '../bundles/switch-group.js';

const LAST_MESSAGE_PREVIEW = 80;

type Db = Prisma.TransactionClient | PrismaService;

/** 스토어 상품 ID로 찾은 우리 상품(배우·커플방 또는 묶음) */
interface StoreTargetInfo {
  productId: string;
  actorId: string | undefined;
  bundleId: string | undefined;
  priceCents: number;
  actorIds: string[];
  prices: Map<string, number>;
}

/** 스토어 알림을 우리 쪽 사건으로 옮긴 것(store-events.ts가 애플·구글 알림을 이걸로 바꿈) */
export type StoreEvent =
  // refundReversed: 애플 환불 취소(REFUND_REVERSED) — 그 결제의 환불 표시를 지우고 다시 결제됨으로(2026-10-27)
  | { kind: 'PAID'; transaction: StoreTransaction; refundReversed?: boolean }
  | { kind: 'GRACE'; originalTransactionId: string; until: Date }
  // expiresAt: 알림이 말하는 만료 시각 — 우리가 아는 만료일이 더 뒤면(그 사이 갱신됨) 늦게 온 옛 알림이라 무시
  | { kind: 'EXPIRED'; originalTransactionId: string; expiresAt?: Date }
  | { kind: 'REFUNDED'; originalTransactionId: string; storeTransactionId?: string }
  // 자동 갱신 끔(팬이 스토어에서 해지)·다시 켬 — 방은 그대로(기간 끝까지 이용), 표시만 바뀜
  | { kind: 'RENEWAL'; originalTransactionId: string; willRenew: boolean }
  | { kind: 'IGNORED'; reason: string };

/** 유효한 구매 하나 — 배우 개인(actorId) 또는 묶음(bundle, 포함 배우들) */
const PURCHASE_INCLUDE = {
  bundle: { select: { id: true, name: true, priceCents: true, actors: { select: { actorId: true } } } },
} as const;
type PurchaseRow = Prisma.PurchaseGetPayload<{ include: typeof PURCHASE_INCLUDE }>;

// 묶음의 구독 그룹(같은 CP 묶음 갈아타기, 2026-10-22)을 알려고 든 방의 종류·CP 멤버까지
const GROUP_BUNDLE_SELECT = {
  id: true,
  name: true,
  storeProductId: true,
  actors: { select: { actor: { select: { id: true, kind: true, coupleMembers: { select: { memberId: true } } } } } },
} as const;
const groupActors = (bundle: { actors: { actor: GroupActor }[] }) => bundle.actors.map((item) => item.actor);

// 구독 관리의 "지난 구독"은 최근 이만큼만
const PAST_SUBSCRIPTIONS_LIMIT = 50;

/**
 * 해지 예정 방의 이용 종료 시각(2026-10-02) — 이 방을 열어 주는 구매가 전부 스토어 결제이고 자동 갱신이 꺼져 있으면 그중 가장 늦은 만료일.
 * 하나라도 갱신 예정이거나 테스트 구독(만료일 없음)이면 null(계속 이용). 앱 대화 목록·구독 관리의 "○월 ○일까지 이용".
 */
export function endsAtOf(purchases: Pick<PurchaseRow, 'iapExpiresAt' | 'willRenew'>[]): Date | null {
  if (purchases.length === 0 || purchases.some((purchase) => purchase.willRenew || !purchase.iapExpiresAt)) return null;
  return new Date(Math.max(...purchases.map((purchase) => purchase.iapExpiresAt!.getTime())));
}

/**
 * 다음 결제 예정일(참고용, 2026-10-28 버블 비교) — 이 방을 열어 주는 스토어 구매 중 자동 갱신 예정인 것의 가장 이른 만료일.
 * 실제 청구일은 스토어가 정해서 하루쯤 다를 수 있음(앱에 "참고용" 표시). 테스트 구독·해지 예정만 있으면 null.
 */
export function renewsAtOf(purchases: Pick<PurchaseRow, 'iapExpiresAt' | 'willRenew'>[]): Date | null {
  const renewing = purchases.filter((purchase) => purchase.willRenew && purchase.iapExpiresAt);
  if (renewing.length === 0) return null;
  return new Date(Math.min(...renewing.map((purchase) => purchase.iapExpiresAt!.getTime())));
}

function actorIdsOf(purchase: PurchaseRow): string[] {
  return purchase.actorId ? [purchase.actorId] : (purchase.bundle?.actors.map((item) => item.actorId) ?? []);
}

/**
 * 구독 = "구매(Purchase)"와 "방 이용권(Subscription)" 두 층(2026-09-29 묶음 구독 도입).
 * - 구매: 팬이 산 것 — 배우 개인 구독 하나 또는 묶음 하나. 해지·만료는 구매 단위.
 * - 방 이용권: 사람×배우 채팅방. 유효한 구매가 하나라도 그 배우를 포함하면 열림(syncAccess가 다시 계산). 대화가 보이기
 *   시작하는 시점(startedAt)·읽음·알림 끄기는 방 이용권에 있어서, 개인 구독 → 묶음으로 바꿔도 대화가 끊기지 않음.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iapVerificationService: IapVerificationService,
    private readonly media: MediaService,
    private readonly realtime: RealtimeService,
    private readonly ledger: ChargeLedgerService,
    private readonly config: ConfigService,
    private readonly alerts?: AdminAlertService,
  ) {}

  /**
   * 내 구독 = 인박스 목록(B3 시안) — 채팅방마다 스타의 마지막 메시지 미리보기, 안 읽은 스타 메시지 수, 스타의 마지막 메시지가 최근인 순(없으면 구독 시작) 정렬.
   * 안 읽음 = 마지막으로 채팅방을 본 시각(lastReadAt, 없으면 구독 시작) 이후의 스타 메시지.
   * coveredBy: 이 방을 열어 주는 구매들(개인 구독/묶음) — 구독 관리 화면에서 "묶음으로 이용 중" 표시·해지 안내용.
   */
  async listMine(userId: string) {
    const [subscriptions, me, purchases] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId, cancelledAt: null },
        include: {
          actor: {
            select: { id: true, chatDisplayName: true, chatProfileImageUrl: true, monthlyPriceCents: true },
          },
        },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nickname: true, displayName: true } }),
      this.activePurchases(this.prisma, userId),
    ]);
    const fanName = me.nickname ?? me.displayName;
    const rows = await Promise.all(
      subscriptions.map(async (subscription) => {
        const visible = { actorId: subscription.actorId, deletedAt: null, createdAt: { gte: subscription.startedAt } };
        const readFrom = subscription.lastReadAt && subscription.lastReadAt > subscription.startedAt ? subscription.lastReadAt : subscription.startedAt;
        const [last, unreadCount, chatProfileImageUrl, unreadQuote] = await Promise.all([
          // 미리보기·정렬은 스타의 마지막 메시지 기준(2026-10-16 사용자 결정) — 내 답장은 나만 보는 거라 목록에서 정보 가치가 낮고,
          // 내가 답장할 때마다 그 방이 맨 위로 올라가 새 메시지 온 방이 묻히지 않게
          this.prisma.message.findFirst({
            where: { ...visible, senderType: MessageSenderType.ARTIST },
            orderBy: { createdAt: 'desc' },
            select: { senderType: true, mediaType: true, body: true, createdAt: true },
          }),
          this.prisma.message.count({
            where: { ...visible, senderType: MessageSenderType.ARTIST, createdAt: { gt: readFrom } },
          }),
          this.media.resolveImageUrl(subscription.actor.chatProfileImageUrl),
          // 안 읽은 메시지 중 내 메시지를 인용한 답장이 있는지(2026-10-13) — 인박스에 "내 메시지에 답장했어요"
          this.prisma.message.findFirst({
            where: { ...visible, senderType: MessageSenderType.ARTIST, createdAt: { gt: readFrom }, replyTo: { fanUserId: userId } },
            select: { id: true },
          }),
        ]);
        const covering = purchases.filter((purchase) => actorIdsOf(purchase).includes(subscription.actorId));
        return {
          ...subscription,
          actor: { ...subscription.actor, chatProfileImageUrl },
          unreadCount,
          unreadQuotedReply: !!unreadQuote,
          endsAt: endsAtOf(covering),
          renewsAt: renewsAtOf(covering),
          // 자동 결제 실패로 유예 중인 구매가 있음(2026-10-28) — 앱이 결제 수단 확인 안내
          billingIssue: covering.some((purchase) => !!purchase.billingIssueAt),
          coveredBy: covering.map((purchase) => ({
              purchaseId: purchase.id,
              // 스토어 결제면 해지는 스토어에서(앱이 바로 스토어 구독 관리로 안내)
              iapPlatform: purchase.iapPlatform,
              bundle: purchase.bundle ? { id: purchase.bundle.id, name: purchase.bundle.name, priceCents: purchase.bundle.priceCents } : null,
            })),
          lastMessage: last
            ? {
                senderType: last.senderType,
                mediaType: last.mediaType,
                // 스타 메시지의 {{name}}은 받는 팬 이름으로(채팅방과 같게)
                body: last.body ? last.body.replaceAll('{{name}}', fanName).slice(0, LAST_MESSAGE_PREVIEW) : null,
                createdAt: last.createdAt,
              }
            : null,
        };
      }),
    );
    const activity = (row: (typeof rows)[number]) => (row.lastMessage?.createdAt ?? row.startedAt).getTime();
    return rows.sort((a, b) => activity(b) - activity(a));
  }

  /**
   * 지난 구독(2026-10-02) — 예전에 구독했다가 끝난 방. 구독 관리 화면의 "지난 구독"에서 다시 구독하기로 안내만 하고 대화 내용은 주지 않음
   * (다시 구독해도 이전 대화는 안 보이는 정책 그대로). 활동 종료한 방은 다시 구독할 수 없어서 뺌. 구독 전 화면처럼 공식 이름·공식 사진.
   */
  async listPast(userId: string) {
    const rows = await this.prisma.subscription.findMany({
      where: { userId, cancelledAt: { not: null } },
      orderBy: { cancelledAt: 'desc' },
      take: PAST_SUBSCRIPTIONS_LIMIT,
      select: {
        actorId: true,
        startedAt: true,
        cancelledAt: true,
        actor: {
          select: {
            legalName: true,
            officialProfileImageUrl: true,
            chatProfileImageUrl: true,
            kind: true,
            monthlyPriceCents: true,
            retiredAt: true,
            coupleMembers: { select: { member: { select: { retiredAt: true } } } },
          },
        },
      },
    });
    return Promise.all(
      rows
        .filter((row) => !roomRetired(row.actor))
        .map(async (row) => ({
          actorId: row.actorId,
          startedAt: row.startedAt,
          endedAt: row.cancelledAt,
          actor: {
            id: row.actorId,
            legalName: row.actor.legalName,
            kind: row.actor.kind,
            monthlyPriceCents: row.actor.monthlyPriceCents,
            photoUrl: await this.media.resolveImageUrl(row.actor.officialProfileImageUrl ?? row.actor.chatProfileImageUrl),
          },
        })),
    );
  }

  /** 내 유효한 묶음 구매 — 구독 관리 화면의 묶음 카드 */
  async listMyBundles(userId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: { userId, cancelledAt: null, bundleId: { not: null } },
      orderBy: { startedAt: 'desc' },
      include: {
        bundle: {
          select: {
            id: true,
            name: true,
            priceCents: true,
            actors: { select: { actor: { select: { id: true, chatDisplayName: true, chatProfileImageUrl: true, monthlyPriceCents: true } } } },
          },
        },
      },
    });
    return Promise.all(
      purchases.map(async (purchase) => ({
        purchaseId: purchase.id,
        startedAt: purchase.startedAt,
        iapPlatform: purchase.iapPlatform,
        bundle: {
          id: purchase.bundle!.id,
          name: purchase.bundle!.name,
          priceCents: purchase.bundle!.priceCents,
          actors: await Promise.all(
            purchase.bundle!.actors.map(async ({ actor }) => ({ ...actor, chatProfileImageUrl: await this.media.resolveImageUrl(actor.chatProfileImageUrl) })),
          ),
        },
      })),
    );
  }

  // 결제(IAP)는 계약 성사 후에 붙임 — 지금은 결제 없이 구매 기록만 만드는 샌드박스 플로우(ENABLE_SANDBOX_SUBSCRIBE)
  async subscribe(userId: string, actorId: string) {
    await this.ensureCanSubscribe(userId);
    const actor = await this.ensureActorAvailable(actorId);
    const subscription = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { userId_actorId: { userId, actorId } } });
      // 개인 구독이든 묶음이든 이미 열려 있으면 또 살 필요 없음
      if (existing && !existing.cancelledAt) throw new BadRequestException(appError('ALREADY_SUBSCRIBED'));
      const purchase = await tx.purchase.create({ data: { userId, actorId, priceCents: actor.monthlyPriceCents } });
      // 정산용 결제 기록(샌드박스 — 정산에선 기본 제외)
      await this.ledger.record(tx, purchase.id, { chargedAt: purchase.startedAt, source: ChargeSource.SANDBOX });
      await this.syncAccess(tx, userId, [actorId], new Map([[actorId, actor.monthlyPriceCents]]));
      return tx.subscription.findUniqueOrThrow({ where: { userId_actorId: { userId, actorId } } });
    });
    this.accessChanged(userId);
    return { subscription, basePriceCents: actor.monthlyPriceCents, effectivePriceCents: actor.monthlyPriceCents, bundleDiscountApplied: false };
  }

  /**
   * 묶음 구독(샌드박스). 포함된 배우를 이미 개인 구독 중이면 그 개인 구독은 해지하고 묶음으로 옮김(대화는 그대로 이어짐) —
   * 샌드박스엔 청구가 없어서 바로 해지해도 됨. 실제 결제가 붙으면 스토어 구독은 앱이 끊을 수 없으므로 앱이 구매 전에
   * "개인 구독은 스토어에서 해지해 주세요"를 안내해야 함(replacedActorIds).
   */
  async subscribeBundle(userId: string, bundleId: string) {
    await this.ensureCanSubscribe(userId);
    const bundle = await this.ensureBundleAvailable(bundleId);
    const actorIds = bundle.actors.map((item) => item.actor.id);
    const shares = allocateBundlePrice(bundle.priceCents, bundle.actors.map((item) => item.actor));
    const replacedActorIds = await this.prisma.$transaction(async (tx) => {
      const same = await tx.purchase.findFirst({ where: { userId, bundleId, cancelledAt: null }, select: { id: true } });
      if (same) throw new BadRequestException(appError('ALREADY_SUBSCRIBED_BUNDLE'));
      // 같은 CP 묶음을 이미 갖고 있으면 하나 더 사지 않고 "바꾸기"로(2026-10-22 — 두 번 결제 방지)
      const sibling = await this.sameGroupPurchase(tx, userId, bundleId);
      if (sibling) throw new ConflictException(appError('BUNDLE_SWITCH_INSTEAD', { name: sibling.bundle.name }));
      const solos = await tx.purchase.findMany({
        where: { userId, cancelledAt: null, actorId: { in: actorIds } },
        select: { id: true, actorId: true, iapPlatform: true },
      });
      const purchase = await tx.purchase.create({ data: { userId, bundleId, priceCents: bundle.priceCents } });
      await this.ledger.record(tx, purchase.id, { chargedAt: purchase.startedAt, source: ChargeSource.SANDBOX });
      const sandboxSolos = solos.filter((solo) => !solo.iapPlatform);
      if (sandboxSolos.length) {
        await tx.purchase.updateMany({ where: { id: { in: sandboxSolos.map((solo) => solo.id) } }, data: { cancelledAt: new Date() } });
      }
      await this.syncAccess(tx, userId, actorIds, shares);
      return solos.map((solo) => solo.actorId!);
    });
    this.accessChanged(userId);
    return { bundleId, priceCents: bundle.priceCents, actorIds, replacedActorIds };
  }

  /**
   * 스토어 결제 확인(2026-09-29 보강) — 앱이 결제 직후 보낸 영수증을 스토어 서명·API로 확인하고 구매·방 이용권·결제 기록을 만듦.
   * 막는 것: 다른 계정의 영수증(appAccountToken/계정 id가 다르거나 이미 다른 계정에 연결됨), 만료된 영수증, 등록 안 된 상품,
   * 이 배우·묶음의 상품이 아닌 영수증(예전엔 싼 상품 영수증으로 비싼 배우 방을 열 수 있었음).
   */
  async verifyStorePurchase(userId: string, dto: VerifyPurchaseDto, expected: { actorId?: string; bundleId?: string } = {}, options: { restore?: boolean } = {}) {
    await this.ensureCanSubscribe(userId, { allowOldTerms: options.restore });
    const verified =
      dto.platform === 'IOS'
        ? await this.iapVerificationService.verifyApple(dto.signedTransaction!)
        : await this.iapVerificationService.verifyGoogle(dto.purchaseToken!, dto.productId!);
    if (verified.accountToken && verified.accountToken !== userId) throw new ConflictException(appError('IAP_RECEIPT_IN_USE'));
    if (verified.expiresAt.getTime() <= Date.now()) throw new BadRequestException(appError('IAP_EXPIRED'));
    // 구글 결제 대기(편의점·현금 등, 2026-10-27) — 돈이 들어오기 전엔 방을 열지 않음. 결제가 끝나면 스토어 알림(PURCHASED)이 엶
    if (verified.pending) throw new BadRequestException(appError('IAP_PAYMENT_PENDING'));
    const target = await this.storeTarget(verified.productId);
    if (!target) throw new BadRequestException(appError('IAP_PRODUCT_UNKNOWN'));
    if ((expected.actorId && target.actorId !== expected.actorId) || (expected.bundleId && target.bundleId !== expected.bundleId)) {
      throw new BadRequestException(appError('IAP_PRODUCT_MISMATCH'));
    }
    const result = await this.upsertStorePurchase(userId, verified, target);
    this.accessChanged(userId);
    await this.acknowledgeIfNeeded(verified);
    return result;
  }

  // 구글 구매를 반영한 뒤 아직 확인(acknowledge) 안 됐으면 서버가 확인 — 3일 자동 환불 방지(2026-10-27). 실패는 경고만(IapVerificationService)
  private async acknowledgeIfNeeded(verified: StoreTransaction) {
    if (verified.platform === 'ANDROID' && verified.needsAcknowledge && !verified.pending) {
      await this.iapVerificationService.acknowledgeGoogle(verified.originalTransactionId, verified.productId);
    }
  }

  /**
   * 환불된 결제로 닫힌(또는 없는) 구매를 다시 열려는지(2026-10-27) — 앱에 남은 영수증·늦게 온 옛 알림을 다시 보내 환불받은 방을 다시 여는 것을 막음.
   * 열려 있는 구매의 결제가 환불된 것(스타 미발송 환불처럼 이용은 그대로 두는 환불)은 그대로 갱신.
   */
  private async reopensRefunded(existing: { cancelledAt: Date | null } | null, verified: StoreTransaction): Promise<boolean> {
    if ((existing && !existing.cancelledAt) || !verified.storeTransactionId) return false;
    const charge = await this.prisma.purchaseCharge.findUnique({ where: { storeTransactionId: verified.storeTransactionId }, select: { refundedAt: true } });
    return !!charge?.refundedAt;
  }

  // 개인 구독 결제(배우 화면) — 응답 모양은 샌드박스 구독과 같게
  async verifyPurchase(userId: string, actorId: string, dto: VerifyPurchaseDto) {
    await this.verifyStorePurchase(userId, dto, { actorId });
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId_actorId: { userId, actorId } } });
    const actor = await this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { monthlyPriceCents: true } });
    return { subscription, basePriceCents: actor.monthlyPriceCents, effectivePriceCents: actor.monthlyPriceCents, bundleDiscountApplied: false };
  }

  // 묶음 결제 — 이미 개인 구독 중인 배우는 스토어 구독이라 앱이 끊을 수 없어서 목록만 돌려줌(앱이 "스토어에서 해지" 안내)
  async verifyBundlePurchase(userId: string, bundleId: string, dto: VerifyPurchaseDto) {
    const { actorIds } = await this.verifyStorePurchase(userId, dto, { bundleId });
    const solos = await this.prisma.purchase.findMany({
      where: { userId, cancelledAt: null, actorId: { in: actorIds } },
      select: { actorId: true },
    });
    return { bundleId, actorIds, replacedActorIds: solos.map((solo) => solo.actorId!) };
  }

  /** 구매 복원(기기 변경·재설치) — 앱이 스토어에서 받은 영수증들을 한 번에. 하나가 실패해도 나머지는 계속, 결과를 하나씩 알려 줌 */
  async restorePurchases(userId: string, items: VerifyPurchaseDto[]) {
    const results: { productId?: string; restored: boolean; code?: string }[] = [];
    for (const item of items) {
      try {
        // 약관 버전이 바뀐 뒤 다시 동의하기 전에도 이미 결제한 구독은 복원돼야 함(2026-10-28 점검)
        const { target } = await this.verifyStorePurchase(userId, item, {}, { restore: true });
        results.push({ productId: target.productId, restored: true });
      } catch (error) {
        const code = (error as { response?: { code?: string } }).response?.code;
        results.push({ productId: item.productId, restored: false, code: code ?? 'IAP_RESTORE_FAILED' });
      }
    }
    return { results };
  }

  // 스토어 상품 ID → 우리 상품(배우·커플방 또는 묶음)
  private async storeTarget(productId: string) {
    const [actor, bundle] = await Promise.all([
      this.prisma.actor.findUnique({ where: { storeProductId: productId }, select: { id: true, monthlyPriceCents: true } }),
      this.prisma.bundle.findUnique({
        where: { storeProductId: productId },
        select: { id: true, priceCents: true, actors: { select: { actor: { select: { id: true, monthlyPriceCents: true } } } } },
      }),
    ]);
    if (actor) return { productId, actorId: actor.id, bundleId: undefined, priceCents: actor.monthlyPriceCents, actorIds: [actor.id], prices: new Map([[actor.id, actor.monthlyPriceCents]]) };
    if (bundle) {
      const actors = bundle.actors.map((item) => item.actor);
      return { productId, actorId: undefined, bundleId: bundle.id, priceCents: bundle.priceCents, actorIds: actors.map((a) => a.id), prices: allocateBundlePrice(bundle.priceCents, actors) };
    }
    return null;
  }

  /**
   * 스토어 구매를 우리 구매로 — 같은 구독 인스턴스(originalTransactionId)가 있으면 만료일만 늘리고(갱신·복원), 없으면 새로(새 상품이면
   * 판매 중인지 확인). 결제 기록은 스토어 결제 id로 한 번만. 다른 계정에 이미 연결된 영수증이면 409.
   * 같은 CP 묶음 갈아타기(2026-10-22): 같은 구독인데 상품이 다르면(애플 — 같은 originalTransactionId, 구글 — 새 토큰이 예전 토큰을
   * linkedPurchaseToken으로 가리킴) 그 구매의 묶음을 새것으로 바꾸고 방·정산을 새 묶음 기준으로(switchStorePurchase). 그 구독의 최근 결제보다
   * 오래된 결제(늦게 온 옛 알림)면 바꾸지 않음.
   */
  private async upsertStorePurchase(
    userId: string,
    verified: StoreTransaction,
    target: StoreTargetInfo,
    options: { fromStore?: boolean; retried?: boolean } = {},
  ): Promise<{ purchaseId: string; actorIds: string[]; target: StoreTargetInfo }> {
    let existing = await this.prisma.purchase.findUnique({ where: { iapTransactionId: verified.originalTransactionId } });
    if (existing && existing.userId !== userId) throw new ConflictException(appError('IAP_RECEIPT_IN_USE'));
    // 구글 갈아타기 — 새 토큰이 처음 오면 예전 토큰의 구매를 이어받음(다른 계정의 구매면 잇지 않음)
    if (!existing && verified.replacesTransactionId) {
      const replaced = await this.prisma.purchase.findUnique({ where: { iapTransactionId: verified.replacesTransactionId } });
      if (replaced && replaced.userId === userId) existing = replaced;
    }
    if (await this.reopensRefunded(existing, verified)) throw new BadRequestException(appError('IAP_EXPIRED'));
    const switching = !!existing && ((existing.actorId ?? undefined) !== target.actorId || (existing.bundleId ?? undefined) !== target.bundleId);
    if (existing && switching) {
      const latest = await this.prisma.purchaseCharge.findFirst({
        where: { purchaseId: existing.id, kind: { in: [ChargeKind.PAYMENT, ChargeKind.SWITCH_CARRY] } },
        orderBy: { chargedAt: 'desc' },
        select: { chargedAt: true },
      });
      // 늦게 온 옛 알림(예전 묶음의 갱신) — 이미 새 묶음으로 바뀐 구매를 되돌리지 않음
      if (latest && verified.purchasedAt < latest.chargedAt) return { purchaseId: existing.id, actorIds: [], target };
    }
    // 판매 가능 확인은 앱의 결제 확인 요청에서만 — 스토어 알림은 이미 돈이 빠진 결제라 막으면 방도 안 열리고 400에 같은 알림만 계속 다시 옴(2026-10-28 점검)
    if (!existing && !options.fromStore) {
      if (target.actorId) await this.ensureActorAvailable(target.actorId);
      if (target.bundleId) await this.ensureBundleAvailable(target.bundleId);
    }
    const charge = {
      chargedAt: verified.purchasedAt,
      periodEnd: verified.expiresAt,
      // 애플 샌드박스(앱 심사·TestFlight)·구글 테스트 결제는 이용은 열되 정산·매출에선 빠지게 SANDBOX로(2026-10-27)
      source: verified.sandbox ? ChargeSource.SANDBOX : sourceOf(verified.platform),
      storeTransactionId: verified.storeTransactionId,
      storeAmountMilli: verified.storeAmountMilli,
      storeCurrency: verified.storeCurrency,
    };
    const iap = {
      iapPlatform: verified.platform,
      iapTransactionId: verified.originalTransactionId,
      iapExpiresAt: verified.expiresAt,
      // 갱신 여부는 스토어가 알려 줄 때만(앱의 영수증 확인엔 없음 — 그대로 둠)
      ...(verified.willRenew === undefined ? {} : { willRenew: verified.willRenew }),
    };
    let purchaseId: string;
    try {
      purchaseId =
        existing && switching
          ? await this.switchStorePurchase(userId, verified, target, existing, iap, charge)
          : await this.writeStorePurchase(userId, verified, target, existing, iap, charge);
    } catch (error) {
      // 같은 영수증 확인이 동시에 두 번 오면(앱 재시도·스토어 알림과 겹침) 한쪽이 고유 제약에 걸림 — 예전엔 500. 이미 생긴 구매로 다시 처리
      if (!options.retried && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.upsertStorePurchase(userId, verified, target, { ...options, retried: true });
      }
      throw error;
    }
    return { purchaseId, actorIds: target.actorIds, target };
  }

  private async writeStorePurchase(
    userId: string,
    verified: StoreTransaction,
    target: StoreTargetInfo,
    existing: { id: string; iapExpiresAt: Date | null; cancelledAt: Date | null } | null,
    iap: { iapPlatform: 'IOS' | 'ANDROID'; iapTransactionId: string; iapExpiresAt: Date; willRenew?: boolean },
    charge: Parameters<ChargeLedgerService['record']>[2],
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      let id: string;
      // 결제 실패(유예 끝·결제 보류)로 닫혔던 같은 스토어 구독이 회복됨(2026-10-27) — 재구독이 아니라 대화를 이어서 보여 줌.
      // 환불로 닫힌 구매(마지막 결제가 환불됨)는 해당 없음
      let resumeSince: Date | undefined;
      if (existing?.cancelledAt && verified.recovered) {
        const last = await tx.purchaseCharge.findFirst({
          where: { purchaseId: existing.id, kind: ChargeKind.PAYMENT },
          orderBy: { chargedAt: 'desc' },
          select: { refundedAt: true },
        });
        if (!last?.refundedAt) resumeSince = existing.cancelledAt;
      }
      if (existing) {
        // 만료일은 늘리기만(늦게 온 옛 영수증이 줄이지 않게) — DB의 지금 값과 비교하는 조건부 갱신이라 새 갱신 알림과 옛 영수증 확인이
        // 동시에 와도 줄지 않음(예전엔 트랜잭션 밖에서 읽은 값으로 덮어써서 뒤에 쓴 옛 값이 이겼음, 2026-10-28 점검)
        const { iapExpiresAt, ...rest } = iap;
        await tx.purchase.update({ where: { id: existing.id }, data: { ...rest, cancelledAt: null, billingIssueAt: null } });
        await tx.purchase.updateMany({
          where: { id: existing.id, OR: [{ iapExpiresAt: null }, { iapExpiresAt: { lt: iapExpiresAt } }] },
          data: { iapExpiresAt },
        });
        id = existing.id;
      } else {
        const created = await tx.purchase.create({
          data: { userId, actorId: target.actorId, bundleId: target.bundleId, priceCents: target.priceCents, startedAt: verified.purchasedAt, ...iap },
        });
        id = created.id;
      }
      // 같은 결제(storeTransactionId)는 한 번만 — 스토어 알림이 먼저 기록했어도 중복 없음
      if (verified.storeTransactionId || !existing) await this.ledger.record(tx, id, charge);
      await this.syncAccess(tx, userId, target.actorIds, target.prices, resumeSince);
      return id;
    });
  }

  /**
   * 스토어에서 묶음이 바뀜(같은 CP 묶음 갈아타기, 2026-10-22) — 구매 하나는 그대로 두고 상품만 새 묶음으로. 방은 예전·새 묶음 방을 함께 다시
   * 계산(겹치는 방은 대화 그대로, 빠진 방만 닫힘). 정산: 바뀐 시각에 남은 기간 몫을 예전 묶음에서 빼고(creditUnused) —
   * 애플: 남은 돈은 애플이 팬에게 돌려주므로 새 묶음은 이번 결제(정가 새 한 달)만 기록. 구글: 앱이 with-time-proration으로 바꿔서 새로 받는 돈이 없고
   * 남은 몫이 새 묶음 기간으로 넘어가므로 그만큼을 새 묶음 이월(SWITCH_CARRY)로. 애플 내리기는 갱신 결제 때 바뀌어 뺄 게 없음.
   */
  private async switchStorePurchase(
    userId: string,
    verified: StoreTransaction,
    target: StoreTargetInfo,
    existing: { id: string; actorId: string | null; bundleId: string | null },
    iap: { iapPlatform: 'IOS' | 'ANDROID'; iapTransactionId: string; iapExpiresAt: Date; willRenew?: boolean },
    charge: Parameters<ChargeLedgerService['record']>[2],
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.purchase.findUniqueOrThrow({ where: { id: existing.id }, include: PURCHASE_INCLUDE });
      const credit = await this.ledger.creditUnused(tx, existing.id, verified.purchasedAt);
      await tx.purchase.update({
        where: { id: existing.id },
        data: { ...iap, cancelledAt: null, billingIssueAt: null, actorId: target.actorId ?? null, bundleId: target.bundleId ?? null, priceCents: target.priceCents },
      });
      if (verified.platform === IapPlatform.ANDROID) {
        if (credit.totalCents > 0) {
          await this.ledger.record(tx, existing.id, {
            ...charge,
            amountCents: credit.totalCents,
            kind: ChargeKind.SWITCH_CARRY,
            switchOfChargeId: credit.fromChargeId ?? undefined,
            productNote: '(묶음 변경 — 남은 기간 이월)',
          });
        }
      } else {
        await this.ledger.record(tx, existing.id, charge);
      }
      await this.syncAccess(tx, userId, [...actorIdsOf(before), ...target.actorIds], target.prices);
      return existing.id;
    });
  }

  /**
   * 스토어 서버 알림 반영(애플 서버 알림 V2·구글 RTDN, StoreNotificationsService가 해석해서 넘김).
   * - PAID: 결제됨(첫 결제·갱신·재구독) → 만료일 늘리고 결제 기록. 우리 구매가 아직 없으면 결제에 심어 둔 사용자 id로 만듦(앱이
   *   결제 직후 꺼져 확인 요청을 못 보낸 경우).
   * - GRACE: 결제 실패지만 스토어 유예 기간 — 그때까지 이용 유지.
   * - EXPIRED: 만료·결제 보류 → 해지 처리(방 닫힘).
   * - REFUNDED: 환불·취소 → 결제 기록을 환불로, 이용도 끊음.
   */
  async applyStoreEvent(event: StoreEvent) {
    if (event.kind === 'IGNORED') return { applied: false };
    if (event.kind === 'PAID') {
      const existing =
        (await this.prisma.purchase.findUnique({ where: { iapTransactionId: event.transaction.originalTransactionId } })) ??
        // 구글 묶음 갈아타기 — 새 토큰의 첫 알림이면 예전 토큰의 구매로 누구 것인지 앎
        (event.transaction.replacesTransactionId ? await this.prisma.purchase.findUnique({ where: { iapTransactionId: event.transaction.replacesTransactionId } }) : null);
      const userId = existing?.userId ?? event.transaction.accountToken;
      if (!userId) return { applied: false };
      if (!existing && !(await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) return { applied: false };
      const target = await this.storeTarget(event.transaction.productId);
      if (!target) return { applied: false };
      // 구글 결제 대기 — 결제가 끝난 뒤 알림에서 엶
      if (event.transaction.pending) return { applied: false };
      if (event.refundReversed && event.transaction.storeTransactionId) {
        await this.ledger.unmarkRefunded(this.prisma, event.transaction.storeTransactionId);
        // 기간이 이미 끝난 결제면 환불 표시만 되돌림(방은 다시 안 엶)
        if (event.transaction.expiresAt.getTime() <= Date.now()) return { applied: true };
      }
      if (await this.reopensRefunded(existing, event.transaction)) return { applied: false };
      // 기간이 이미 끝난 결제의 늦게 온·다시 온 알림(2026-10-28 점검) — 결제 기록만 남기고 방은 다시 열지 않음. 예전엔 만료로 닫힌 구매가
      // 새 결제 없이 다시 열려(대화 기록 처음부터) 만료 정리 때까지 이용됐음
      if (event.transaction.expiresAt.getTime() <= Date.now()) {
        if (existing && event.transaction.storeTransactionId) {
          await this.ledger.record(this.prisma, existing.id, {
            chargedAt: event.transaction.purchasedAt,
            periodEnd: event.transaction.expiresAt,
            source: event.transaction.sandbox ? ChargeSource.SANDBOX : sourceOf(event.transaction.platform),
            storeTransactionId: event.transaction.storeTransactionId,
            storeAmountMilli: event.transaction.storeAmountMilli,
            storeCurrency: event.transaction.storeCurrency,
          });
        }
        return { applied: true };
      }
      // 앱 확인 없이 알림으로 처음 만드는 구매도 미성년자 확인(2026-10-28 점검 — 부모 동의 대기·성년 미만이 이 경로로 방을 열 수 있었음).
      // 이미 결제된 건이라 방은 열지 않고 운영자에게 환불 처리를 알림(잠정 정책, STATUS "출시 전 확정할 정책")
      if (!existing) {
        const blocked = await this.subscribeBlockReason(userId);
        if (blocked) {
          await this.alerts?.notify('REFUND', '가입 조건 미충족 계정의 결제', `${blocked} 계정(${userId})의 스토어 결제가 들어왔어요(상품 ${event.transaction.productId}). 방은 열지 않았어요 — 스토어에서 환불해 주세요.`, { userId });
          return { applied: false };
        }
      }
      await this.upsertStorePurchase(userId, event.transaction, target, { fromStore: true });
      this.accessChanged(userId);
      await this.acknowledgeIfNeeded(event.transaction);
      return { applied: true };
    }
    const purchase = await this.prisma.purchase.findUnique({ where: { iapTransactionId: event.originalTransactionId }, include: PURCHASE_INCLUDE });
    if (event.kind === 'REFUNDED' && event.storeTransactionId) {
      await this.ledger.markRefunded(this.prisma, event.storeTransactionId);
      // 이미 끝난 기간의 결제만 환불된 것(예: 스타 미발송 환불로 지난달만 돌려줌)이면 지금 이용 중인 기간은 그대로 둠(2026-09-29)
      const charge = await this.prisma.purchaseCharge.findUnique({ where: { storeTransactionId: event.storeTransactionId }, select: { periodEnd: true } });
      if (charge && charge.periodEnd <= new Date()) return { applied: true };
      // 우리 기록에 없는 결제의 환불(알림을 놓친 지난 결제일 수 있음) — 지금 이용 중인 구매를 닫지 않고 운영자가 확인(2026-10-28 점검)
      if (!charge && purchase && !purchase.cancelledAt) {
        await this.alerts?.notify('REFUND', '기록에 없는 결제의 환불', `구매 ${purchase.id}의 스토어 결제 ${event.storeTransactionId}가 환불됐는데 결제 기록이 없어요. 방은 그대로 뒀어요 — 스토어에서 이용 기간을 확인해 주세요.`, { userId: purchase.userId });
        return { applied: true };
      }
    }
    if (!purchase) return { applied: event.kind === 'REFUNDED' };
    if (event.kind === 'RENEWAL') {
      if (purchase.willRenew !== event.willRenew) {
        await this.prisma.purchase.update({ where: { id: purchase.id }, data: { willRenew: event.willRenew } });
        this.accessChanged(purchase.userId);
      }
      return { applied: true };
    }
    if (event.kind === 'GRACE') {
      const extend = !purchase.iapExpiresAt || event.until > purchase.iapExpiresAt;
      if (extend || !purchase.billingIssueAt) {
        await this.prisma.purchase.update({
          where: { id: purchase.id },
          data: { ...(extend ? { iapExpiresAt: event.until } : {}), billingIssueAt: purchase.billingIssueAt ?? new Date() },
        });
        this.accessChanged(purchase.userId);
      }
      return { applied: true };
    }
    // 스토어 알림은 순서가 뒤바뀌어 올 수 있음 — 예전 만료 알림이 갱신 뒤에 도착하면 결제한 팬의 방을 닫게 됨(2026-09-29 점검).
    // 우리가 아는 만료일이 이미 지났으면 옛 알림이 아님(2026-10-27) — 유예(GRACE)가 만료일을 늘려 둔 뒤 온 유예 끝·결제 재시도 끝 만료 알림이
    // 예전엔 "늦게 온 옛 알림"으로 버려져 방이 sweepExpired까지 열려 있었음
    if (event.kind === 'EXPIRED' && event.expiresAt) {
      const now = Date.now();
      if (event.expiresAt.getTime() > now) return { applied: false };
      if (purchase.iapExpiresAt && purchase.iapExpiresAt > event.expiresAt && purchase.iapExpiresAt.getTime() > now) return { applied: false };
    }
    // EXPIRED · REFUNDED — 아직 열려 있으면 닫음
    if (!purchase.cancelledAt) await this.closePurchase(purchase);
    return { applied: true };
  }

  // 여러 서버가 같은 구매를 동시에 닫아도(알림·만료 정리가 겹침) 한 번만 — 아직 열려 있을 때만 닫고, 닫은 쪽만 해지 이력을 남김(2026-10-27)
  private async closePurchase(purchase: PurchaseRow): Promise<boolean> {
    const closed = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.purchase.updateMany({ where: { id: purchase.id, cancelledAt: null }, data: { cancelledAt: now } });
      if (count !== 1) return false;
      await this.syncAccess(tx, purchase.userId, actorIdsOf(purchase), new Map());
      return true;
    });
    if (closed) this.accessChanged(purchase.userId);
    return closed;
  }

  /**
   * 만료 정리(매시간) — 스토어 알림을 놓쳐도 만료일이 지난 스토어 구매는 닫음. 알림이 조금 늦게 와서 멀쩡한 갱신을 닫지 않게
   * IAP_EXPIRY_GRACE_HOURS(기본 24시간) 지난 것만. 잘못 닫혀도 앱의 "구매 복원"이나 다음 갱신 알림이 다시 엶.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpired(now = new Date()) {
    const hours = Number(this.config.get<string>('IAP_EXPIRY_GRACE_HOURS'));
    const graceMs = (Number.isFinite(hours) && hours >= 0 ? hours : 24) * 60 * 60 * 1000;
    const expired = await this.prisma.purchase.findMany({
      where: { iapPlatform: { not: null }, cancelledAt: null, iapExpiresAt: { lt: new Date(now.getTime() - graceMs) } },
      include: PURCHASE_INCLUDE,
    });
    let closed = 0;
    for (const purchase of expired) if (await this.closePurchase(purchase)) closed += 1;
    return closed;
  }

  /**
   * 같은 CP 묶음 갈아타기 안내(2026-10-22) — 이 묶음과 같은 구독 그룹(같은 CP방)의 다른 묶음을 이미 갖고 있으면 그 구매와 바뀌는 시점.
   * 앱의 묶음 구독 화면이 [구독하기] 대신 [이 묶음으로 바꾸기]를 보여 줌. 없으면 null.
   */
  async switchInfo(userId: string, bundleId: string) {
    const from = await this.sameGroupPurchase(this.prisma, userId, bundleId);
    if (!from) return null;
    return {
      purchaseId: from.purchase.id,
      bundle: { id: from.bundle.id, name: from.bundle.name, storeProductId: from.bundle.storeProductId },
      platform: from.purchase.iapPlatform,
      timing: switchTiming(from.fromGroup, from.toGroup, from.purchase.iapPlatform),
      // 애플 내리기면 이때 바뀜(다음 갱신)
      renewsAt: from.purchase.iapExpiresAt,
    };
  }

  /**
   * 테스트 구독(결제 없음) 묶음 바꾸기(2026-10-22) — 스토어 결제는 스토어 결제창에서 바꾸고 결제 확인이 처리함. 바로 바뀌고, 남은 기간 몫은 새 묶음으로 이월
   * (구글과 같은 방식). 스토어 구독이면 409(스토어에서 바꿔야 함).
   */
  async switchBundle(userId: string, bundleId: string) {
    await this.ensureCanSubscribe(userId);
    const bundle = await this.ensureBundleAvailable(bundleId);
    const actorIds = bundle.actors.map((item) => item.actor.id);
    const shares = allocateBundlePrice(bundle.priceCents, bundle.actors.map((item) => item.actor));
    const result = await this.prisma.$transaction(async (tx) => {
      const from = await this.sameGroupPurchase(tx, userId, bundleId);
      if (!from) throw new NotFoundException(appError('PURCHASE_NOT_FOUND'));
      if (from.purchase.iapPlatform) throw new ConflictException(appError('IAP_MANAGE_IN_STORE'));
      const before = await tx.purchase.findUniqueOrThrow({ where: { id: from.purchase.id }, include: PURCHASE_INCLUDE });
      const now = new Date();
      const credit = await this.ledger.creditUnused(tx, before.id, now);
      await tx.purchase.update({ where: { id: before.id }, data: { bundleId, actorId: null, priceCents: bundle.priceCents } });
      if (credit.totalCents > 0) {
        await this.ledger.record(tx, before.id, {
          chargedAt: now,
          periodEnd: credit.periodEnd ?? undefined,
          source: ChargeSource.SANDBOX,
          amountCents: credit.totalCents,
          kind: ChargeKind.SWITCH_CARRY,
          switchOfChargeId: credit.fromChargeId ?? undefined,
          productNote: '(묶음 변경 — 남은 기간 이월)',
        });
      }
      await this.syncAccess(tx, userId, [...actorIdsOf(before), ...actorIds], shares);
      return { purchaseId: before.id, fromBundleId: from.bundle.id };
    });
    this.accessChanged(userId);
    return { ...result, bundleId, actorIds };
  }

  /** 이 묶음과 같은 구독 그룹(같은 CP방)인 다른 묶음의 유효한 구매(있으면 하나) */
  private async sameGroupPurchase(db: Db, userId: string, bundleId: string) {
    const target = await db.bundle.findUnique({ where: { id: bundleId }, select: GROUP_BUNDLE_SELECT });
    const toGroup = target && storeGroupOf(groupActors(target));
    if (!toGroup) return null;
    const purchases = await db.purchase.findMany({
      where: { userId, cancelledAt: null, bundleId: { not: null } },
      select: { id: true, bundleId: true, iapPlatform: true, iapExpiresAt: true, bundle: { select: GROUP_BUNDLE_SELECT } },
      orderBy: { startedAt: 'asc' },
    });
    // 이 묶음 자체를 이미 가졌으면 바꿀 게 없음
    if (purchases.some((purchase) => purchase.bundleId === bundleId)) return null;
    for (const purchase of purchases) {
      const fromGroup = purchase.bundle && storeGroupOf(groupActors(purchase.bundle));
      if (fromGroup && fromGroup.roomId === toGroup.roomId) return { purchase, bundle: purchase.bundle!, fromGroup, toGroup };
    }
    return null;
  }

  /**
   * 배우 채팅방 해지 — 그 배우 개인 구독을 해지. 묶음으로만 열려 있으면 묶음 전체를 해지해야 해서 앱이 묶음 해지로
   * 안내하도록 409(COVERED_BY_BUNDLE, 묶음 이름·구매 ID 포함).
   */
  async unsubscribe(userId: string, actorId: string) {
    const purchases = (await this.activePurchases(this.prisma, userId)).filter((purchase) => actorIdsOf(purchase).includes(actorId));
    if (purchases.length === 0) throw new NotFoundException(appError('NOT_SUBSCRIBED'));
    const solo = purchases.find((purchase) => purchase.actorId === actorId);
    if (!solo) {
      const bundle = purchases.find((purchase) => purchase.bundle)!;
      throw new ConflictException(appError('COVERED_BY_BUNDLE', { name: bundle.bundle!.name }));
    }
    return this.cancelPurchase(userId, solo.id);
  }

  /** 구매 하나 해지(개인 구독·묶음 공통) — 포함된 방 중 다른 유효한 구매가 없는 방만 닫힘 */
  async cancelPurchase(userId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id: purchaseId, userId, cancelledAt: null }, include: PURCHASE_INCLUDE });
    if (!purchase) throw new NotFoundException(appError('PURCHASE_NOT_FOUND'));
    // 스토어 구독은 앱이 끊을 수 없음 — 여기서 닫으면 결제는 계속되는데 방만 닫힘. 스토어 구독 관리로 안내(앱이 코드로 분기)
    if (purchase.iapPlatform) throw new ConflictException(appError('IAP_MANAGE_IN_STORE'));
    await this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({ where: { id: purchase.id }, data: { cancelledAt: new Date() } });
      await this.syncAccess(tx, userId, actorIdsOf(purchase), new Map());
    });
    this.accessChanged(userId);
    return { purchaseId: purchase.id, actorIds: actorIdsOf(purchase) };
  }

  // 배우별 알림 끄기/켜기
  async setNotificationsMuted(userId: string, actorId: string, muted: boolean) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId_actorId: { userId, actorId } } });
    if (!existing || existing.cancelledAt) throw new NotFoundException(appError('NOT_SUBSCRIBED'));
    return this.prisma.subscription.update({
      where: { id: existing.id },
      data: { notificationsMuted: muted },
      select: { actorId: true, notificationsMuted: true },
    });
  }

  /**
   * 방 이용권을 유효한 구매에 맞춰 다시 계산 — 구매가 생기거나 해지·만료될 때마다 영향 받는 배우들에 대해 부름.
   * 새로 열린 방은 대화를 지금부터 보여줌(재구독 시 이전 대화 비공개, 버블 방식)·시작 이력(STARTED, 가격은 prices),
   * 닫힌 방은 해지 이력(CANCELLED). 이미 열려 있던 방은 그대로(개인 → 묶음 전환에도 대화가 이어짐).
   * resumeSince(2026-10-27): 결제 실패로 닫혔던 같은 스토어 구독의 회복 — 그 구매가 닫힌 시각(resumeSince) 이후에 닫힌 방은 재구독이 아니라서
   * 대화 시작 시점(startedAt)·무사용 판정 기록을 그대로 두고 다시 엶(짧은 결제 실패로 대화가 사라지지 않게).
   * 열기·닫기는 상태가 바뀔 때만(조건부 갱신) — 동시에 두 번 돌아도 이력이 한 번만 남음.
   */
  private async syncAccess(tx: Db, userId: string, actorIds: string[], prices: Map<string, number>, resumeSince?: Date) {
    if (actorIds.length === 0) return;
    // 한 사람의 방 열고 닫기는 한 번에 하나씩(2026-10-28 점검) — 만료로 닫는 처리와 같은 방을 덮는 새 구매가 동시에 오면 서로의 아직 안 끝난
    // 변경을 못 봐서, 결제된 구매가 있는데도 방이 닫힌 채 남을 수 있었음. 트랜잭션이 끝나면 풀림
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription-access:${userId}`}))`;
    const covered = new Set((await this.activePurchases(tx, userId)).flatMap(actorIdsOf));
    const existing = await tx.subscription.findMany({ where: { userId, actorId: { in: actorIds } } });
    const byActor = new Map(existing.map((sub) => [sub.actorId, sub]));
    const now = new Date();
    for (const actorId of new Set(actorIds)) {
      const sub = byActor.get(actorId);
      const open = !!sub && !sub.cancelledAt;
      if (covered.has(actorId) && !open) {
        const fresh = { startedAt: now, cancelledAt: null, lastArtistMessageAt: null, lastFanReplyAt: null };
        if (sub) {
          const resume = !!resumeSince && !!sub.cancelledAt && sub.cancelledAt >= resumeSince;
          const { count } = await tx.subscription.updateMany({ where: { id: sub.id, cancelledAt: { not: null } }, data: resume ? { cancelledAt: null } : fresh });
          if (count !== 1) continue;
        } else await tx.subscription.create({ data: { userId, actorId, ...fresh } });
        await tx.subscriptionEvent.create({ data: { userId, actorId, type: SubscriptionEventType.STARTED, priceCents: prices.get(actorId) } });
      } else if (!covered.has(actorId) && open) {
        const { count } = await tx.subscription.updateMany({ where: { id: sub.id, cancelledAt: null }, data: { cancelledAt: now } });
        if (count !== 1) continue;
        await tx.subscriptionEvent.create({ data: { userId, actorId, type: SubscriptionEventType.CANCELLED } });
      }
    }
  }

  // 이 사람의 구독이 바뀜 — 열려 있는 실시간 연결이 볼 수 있는 방 목록을 바로 다시 읽게(앱은 인박스를 새로고침)
  private accessChanged(userId: string) {
    void this.realtime.publish({ kind: 'access-changed', userId });
  }

  private activePurchases(db: Db, userId: string): Promise<PurchaseRow[]> {
    return db.purchase.findMany({ where: { userId, cancelledAt: null }, include: PURCHASE_INCLUDE, orderBy: { startedAt: 'asc' } });
  }

  private async ensureActorAvailable(actorId: string) {
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
      select: { id: true, monthlyPriceCents: true, retiredAt: true, retireAt: true, releaseAt: true, coupleMembers: { select: { member: { select: { retiredAt: true, retireAt: true } } } } },
    });
    if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
    // 커플방은 멤버 배우 중 한 명이라도 활동 종료면 새 구독 중지(기존 팬은 유지)
    if (roomRetired(actor)) throw new BadRequestException(appError('ACTOR_RETIRED'));
    const retireAt = roomRetireAt(actor);
    if (retireAt) throw new BadRequestException(appError('ACTOR_RETIRING', { retireAt: retireAt.toISOString() }));
    // 공개 예정(2026-10-19) — 공개 시각 전엔 앱이 구독 버튼을 안 보여 주지만 API를 직접 불러도 막음
    if (!isReleased(actor.releaseAt)) throw new BadRequestException(appError('ACTOR_NOT_RELEASED', { releaseAt: actor.releaseAt!.toISOString() }));
    return actor;
  }

  // 판매 중지됐거나, 포함된 배우 중 활동을 종료한 배우가 있으면 새로 못 삼
  private async ensureBundleAvailable(bundleId: string) {
    const bundle = await this.prisma.bundle.findUnique({
      where: { id: bundleId },
      select: {
        id: true,
        priceCents: true,
        active: true,
        releaseAt: true,
        actors: {
          select: {
            actor: {
              select: {
                id: true,
                monthlyPriceCents: true,
                retiredAt: true,
                retireAt: true,
                releaseAt: true,
                coupleMembers: { select: { member: { select: { retiredAt: true, retireAt: true } } } },
              },
            },
          },
        },
      },
    });
    if (!bundle) throw new NotFoundException(appError('BUNDLE_NOT_FOUND'));
    // 든 방 중 하나라도 활동 종료·종료 예정이면 못 삼(2026-10-20 예정 추가)
    if (!bundle.active || bundle.actors.length < 2 || bundle.actors.some((item) => roomRetired(item.actor) || roomRetireAt(item.actor))) {
      throw new BadRequestException(appError('BUNDLE_UNAVAILABLE'));
    }
    // 묶음 자체나 든 방 중 하나라도 공개 전이면 가장 늦은 공개 시각까지 못 삼
    const opensAt = bundleOpensAt(bundle.releaseAt, bundle.actors.map((item) => item.actor.releaseAt));
    if (!isReleased(opensAt)) throw new BadRequestException(appError('ACTOR_NOT_RELEASED', { releaseAt: opensAt!.toISOString() }));
    return bundle;
  }

  // 구독(결제) 전 가입 절차를 서버에서도 강제 — 예전엔 앱 화면에서만 막아서, API를 직접 부르면 약관 동의·생년월일을
  // 건너뛰고(= 미성년자 부모 동의 우회) 구독할 수 있었음(2026-09-28 점검). 미성년자(국가별 기준)인데 법정대리인 동의를
  // 아직 못 받은 계정, 성인만 가입일 때 성년 미만 계정도 막음.
  private async ensureCanSubscribe(userId: string, options: { allowOldTerms?: boolean } = {}): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { termsVersion: true, birthDate: true, parentalConsentStatus: true },
    });
    if (user.termsVersion !== CURRENT_TERMS_VERSION && !(options.allowOldTerms && user.termsVersion)) throw new ForbiddenException(appError('ONBOARDING_REQUIRED'));
    if (!user.birthDate) throw new ForbiddenException(appError('ONBOARDING_REQUIRED'));
    if (user.parentalConsentStatus === ParentalConsentStatus.PENDING) {
      throw new ForbiddenException(appError('CONSENT_REQUIRED_TO_SUBSCRIBE'));
    }
    if (user.parentalConsentStatus === ParentalConsentStatus.UNDERAGE) {
      throw new ForbiddenException(appError('UNDERAGE'));
    }
  }

  /** 스토어 알림으로 구매를 새로 만들 때 막을 계정인지(부모 동의 대기·성년 미만) — 운영자 알림 문구용 이유, 괜찮으면 null */
  private async subscribeBlockReason(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { parentalConsentStatus: true } });
    if (user?.parentalConsentStatus === ParentalConsentStatus.PENDING) return '부모 동의 대기';
    if (user?.parentalConsentStatus === ParentalConsentStatus.UNDERAGE) return '성년 미만';
    return null;
  }
}
