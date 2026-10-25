import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShutdownService } from '../common/lifecycle/shutdown.service.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';

export interface PushRecipient {
  locale: string | null;
  /** 받는 사람 이름 — 닉네임(없으면 로그인 이름). {{name}} 치환용 */
  displayName: string;
}
const DEVICE_SELECT = { token: true, userId: true, user: { select: { locale: true, displayName: true, nickname: true } } } as const;

export type ComposePush = (recipient: PushRecipient) => { title: string; body: string };

/** FCM이 "이 토큰은 더 이상 유효하지 않다"고 알려줄 때의 에러 코드 — 재시도해도 계속 실패하므로 저장된 토큰을 지워야 함 */
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// FCM sendEach 한 번에 보낼 수 있는 최대 메시지 수
const FCM_BATCH_SIZE = 500;

export interface PushDeviceTarget {
  token: string;
  user: PushRecipient;
  /** 앱 아이콘 숫자(안 읽은 아티스트 메시지 합계) — 팬 알림만. 없으면 아이콘 숫자는 그대로 둠 */
  badge?: number;
}

/** 기기별 메시지 만들기 — 받는 사람마다 언어·이름이 달라서 기기마다 따로 조립(순수 함수, 테스트용으로 분리) */
export function buildPushMessages(devices: PushDeviceTarget[], compose: ComposePush, data?: Record<string, string>): Message[] {
  return devices.map(({ token, user, badge }) => {
    const { title, body } = compose(user);
    const hasBadge = badge !== undefined;
    return {
      token,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { channelId: 'messages', ...(hasBadge ? { notificationCount: badge } : {}) } },
      // mutable-content: 아이폰이 알림을 띄우기 전에 앱의 알림 확장(ToffeeNotificationService)이 data의 senderName·senderImage로
      // 카톡처럼 보낸 사람 사진이 있는 "대화 알림"으로 바꿈(2026-10-13). 확장이 없거나 실패하면 원래 알림 그대로
      // badge: 앱을 열지 않아도 아이콘 숫자가 바뀌게(2026-10-15 실기기 — 예전엔 앱이 인박스를 열 때만 숫자를 정해서 앱을 열기 전엔 안 보였음)
      apns: { payload: { aps: { sound: 'default', 'mutable-content': 1, ...(hasBadge ? { badge } : {}) } } },
    };
  });
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * 받는 사람이 끌 수 있는 알림 종류(2026-10-12 역할별 알림 설정) — User의 같은 이름 칸이 true인 사람에게만.
 * notifyArtistMessages: 소속사 직원이 받는 소속 아티스트 새 메시지·스토리 / notifyIdleAlerts: 아티스트·소속사의 장기 미발송 알림
 * (환불 기준 경고는 놓치면 안 돼서 이 설정과 상관없이 감)
 */
export type PushSetting = 'notifyArtistMessages' | 'notifyIdleAlerts';

export interface SendOptions {
  setting?: PushSetting;
  /** 팬 알림 — 받는 사람마다 안 읽은 아티스트 메시지 합계를 앱 아이콘 숫자로 같이 보냄(인박스 unreadCount와 같은 기준) */
  withUnreadBadge?: boolean;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    // 발송은 보통 기다리지 않고(void) 돌려서, 배포 때 끝날 때까지 기다리도록 등록(2026-10-25)
    private readonly shutdown: ShutdownService,
  ) {}

  onModuleInit(): void {
    const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON이 설정되지 않아 FCM 발송이 비활성화됩니다.');
      return;
    }
    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    this.app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  }

  /** 한 사람의 모든 기기로 */
  sendToUser(userId: string, compose: ComposePush, data?: Record<string, string>, options?: SendOptions): Promise<void> {
    return this.sendToUsers([userId], compose, data, options);
  }

  /**
   * 여러 사람의 모든 기기로 — 받는 사람 언어·이름에 맞춰 기기마다 문구를 만들고 500개씩 묶어 발송
   * (구독자가 수천 명이어도 사람마다 따로 요청하지 않게). FCM이 죽었다고 알려준 토큰은 바로 삭제.
   * 실패는 로그만 남기고 호출한 쪽 흐름을 막지 않음(best-effort).
   */
  sendToUsers(userIds: string[], compose: ComposePush, data?: Record<string, string>, options: SendOptions = {}): Promise<void> {
    return this.shutdown.track(this.sendToUsersNow(userIds, compose, data, options));
  }

  private async sendToUsersNow(userIds: string[], compose: ComposePush, data?: Record<string, string>, options: SendOptions = {}): Promise<void> {
    if (!this.app || userIds.length === 0) return;
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: { in: userIds }, user: this.reachableUser(options.setting) },
      select: DEVICE_SELECT,
    });
    await this.deliver(devices, compose, data, options);
  }

  /**
   * 모든 계정에게(2026-10-20 공지 푸시) — 기기를 1,000개씩 나눠 읽어서 보냄(계정 id 목록을 통째로 넘기지 않게)
   */
  sendToEveryone(compose: ComposePush, data?: Record<string, string>): Promise<void> {
    return this.shutdown.track(this.sendToEveryoneNow(compose, data));
  }

  private async sendToEveryoneNow(compose: ComposePush, data?: Record<string, string>): Promise<void> {
    if (!this.app) return;
    let cursor: string | undefined;
    for (;;) {
      const devices = await this.prisma.pushDevice.findMany({
        where: { user: this.reachableUser() },
        select: { id: true, ...DEVICE_SELECT },
        orderBy: { id: 'asc' },
        take: 1000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (devices.length === 0) return;
      await this.deliver(devices, compose, data);
      cursor = devices[devices.length - 1].id;
    }
  }

  // 정지·영구차단·탈퇴한 계정엔 보내지 않음(예전엔 구독만 보고 보내서 제재 중인 팬도 알림을 계속 받았음, 2026-09-28 점검).
  // 정지는 기간이 지났으면 다시 받음(로그인 판단과 같은 기준). 역할별 알림 설정에서 끈 종류면 빼기(2026-10-12)
  private reachableUser(setting?: PushSetting) {
    return {
      deletedAt: null,
      OR: [{ status: UserStatus.ACTIVE }, { status: UserStatus.SUSPENDED, suspendedUntil: { lte: new Date() } }],
      ...(setting ? { [setting]: true } : {}),
    };
  }

  private async deliver(
    devices: { token: string; userId: string; user: { locale: string | null; displayName: string; nickname: string | null } }[],
    compose: ComposePush,
    data?: Record<string, string>,
    options: SendOptions = {},
  ): Promise<void> {
    if (!this.app || devices.length === 0) return;

    const badges = options.withUnreadBadge ? await this.unreadBadges([...new Set(devices.map((device) => device.userId))]) : null;
    const messaging = getMessaging(this.app);
    const deadTokens: string[] = [];
    const targets = devices.map(({ token, userId, user }) => ({
      token,
      user: { locale: user.locale, displayName: user.nickname ?? user.displayName },
      ...(badges ? { badge: badges.get(userId) ?? 0 } : {}),
    }));
    for (const batch of chunk(buildPushMessages(targets, compose, data), FCM_BATCH_SIZE)) {
      try {
        const result = await messaging.sendEach(batch);
        const failureCodes = new Map<string, number>();
        result.responses.forEach((response, index) => {
          const code = response.error?.code;
          if (code) failureCodes.set(code, (failureCodes.get(code) ?? 0) + 1);
          if (code && INVALID_TOKEN_ERROR_CODES.has(code)) deadTokens.push((batch[index] as { token: string }).token);
        });
        // 실패 코드도 같이 — 2026-10-12 실기기에서 푸시가 안 왔는데 "N건 실패"만으론 애플 키 문제(third-party-auth-error)인지 알 수 없었음
        if (result.failureCount > 0) {
          const codes = [...failureCodes].map(([code, count]) => `${code}×${count}`).join(', ');
          this.logger.warn(`FCM 발송 ${batch.length}건 중 ${result.failureCount}건 실패 (${codes})`);
        }
      } catch (error) {
        this.logger.warn(`FCM 발송 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (deadTokens.length > 0) await this.prisma.pushDevice.deleteMany({ where: { token: { in: deadTokens } } });
  }

  /**
   * 사람마다 안 읽은 아티스트 메시지 합계 — 인박스(SubscriptionsService.listMine)의 unreadCount를 모든 방에 더한 것과 같은 기준
   * (구독 중인 방, 구독 시작·마지막으로 본 시각 이후, 지운 메시지 제외). 구독자가 많아도 한 번의 쿼리로
   */
  private async unreadBadges(userIds: string[]): Promise<Map<string, number>> {
    try {
      const rows = await this.prisma.$queryRaw<{ userId: string; count: number }[]>`
        SELECT s."userId", COUNT(m."id")::int AS "count"
        FROM "Subscription" s
        JOIN "Message" m
          ON m."actorId" = s."actorId"
         AND m."senderType" = 'ARTIST'
         AND m."deletedAt" IS NULL
         AND m."createdAt" > GREATEST(s."startedAt", COALESCE(s."lastReadAt", s."startedAt"))
        WHERE s."userId" = ANY(${userIds}::text[]) AND s."cancelledAt" IS NULL
        GROUP BY s."userId"`;
      return new Map(rows.map((row) => [row.userId, Number(row.count)]));
    } catch (error) {
      // 숫자를 못 구해도 알림은 보냄(아이콘 숫자만 빠짐)
      this.logger.warn(`안 읽은 수 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
      return new Map();
    }
  }

  // 배우가 새 메시지를 보낼 때 현재 소속사 스태프 전원에게 알림(모니터링용) — best-effort
  notifyActorStaff(actorId: string, compose: ComposePush, data?: Record<string, string>, setting?: PushSetting): Promise<void> {
    return this.shutdown.track(this.notifyActorStaffNow(actorId, compose, data, setting));
  }

  private async notifyActorStaffNow(actorId: string, compose: ComposePush, data?: Record<string, string>, setting?: PushSetting): Promise<void> {
    // 커플방은 두 멤버 배우의 소속사 직원 모두(각 소속사는 자기 배우가 든 커플방을 모니터링, 2026-09-29)
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
      select: { agencyId: true, coupleMembers: { select: { member: { select: { agencyId: true } } } } },
    });
    const agencyIds = [actor?.agencyId, ...(actor?.coupleMembers.map(({ member }) => member.agencyId) ?? [])].filter((id): id is string => !!id);
    if (agencyIds.length === 0) return;
    const staff = await this.prisma.user.findMany({
      where: { agencyId: { in: [...new Set(agencyIds)] }, role: Role.AGENCY_STAFF },
      select: { id: true },
    });
    await this.sendToUsers(
      staff.map((user) => user.id),
      compose,
      data,
      { setting },
    );
  }
}
