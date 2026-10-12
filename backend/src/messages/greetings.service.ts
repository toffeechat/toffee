import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { ensureIsActorSelf } from '../common/authorization/actor-access.js';
import { ensureActiveSubscription } from '../common/authorization/ensure-active-subscription.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { birthdayToday } from './birthday.js';
import type { UpdateGreetingsDto } from './dto/update-greetings.dto.js';

const NAME_PLACEHOLDER = '{{name}}';

const personalize = (body: string, fanName: string) => body.replaceAll(NAME_PLACEHOLDER, fanName);
const clean = (value: string | undefined) => (value === undefined ? undefined : value.trim() || null);

/**
 * 환영 메시지·생일 축하 메시지(2026-10-12, 버블 비교 점검 → 1차).
 * - 환영 메시지: 아티스트가 방마다 한 번 써 두면, 구독한 팬 대화방 맨 처음(구독 시작 시각)에 보임. 메시지 행을 만들지 않고 보여 줄 때
 *   팬 닉네임을 채워서 내려줌 → 미발송 환불·답장 대상·통계엔 안 셈(버블도 웰컴메시지는 환불 판단에서 뺌).
 * - 생일 축하: 생일 알림을 켠 팬의 생일(태국 날짜) 아침 9시에, 그 팬이 구독 중인 방 중 생일 메시지를 써 둔 방마다 BirthdayGreeting을
 *   하나 만들고 푸시. 그 팬 대화방에만 보이고, 해마다 한 번.
 */
@Injectable()
export class GreetingsService {
  private readonly logger = new Logger(GreetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  /** 팬 대화방에 끼워 넣을 것들 — 환영 메시지(구독 시작 시각)와 이번 구독 기간에 받은 생일 축하 */
  async extrasForFan(userId: string, actorId: string) {
    const subscription = await ensureActiveSubscription(this.prisma, userId, actorId);
    const [actor, fan, birthdays] = await Promise.all([
      this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { welcomeMessage: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nickname: true, displayName: true } }),
      this.prisma.birthdayGreeting.findMany({
        where: { userId, actorId, createdAt: { gte: subscription.startedAt } },
        select: { id: true, body: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      welcome: actor.welcomeMessage
        ? { body: personalize(actor.welcomeMessage, fan.nickname ?? fan.displayName), createdAt: subscription.startedAt }
        : null,
      birthdays,
    };
  }

  /** 스튜디오 "환영·생일 메시지" 편집 화면 */
  async settings(selfUserId: string, actorId: string) {
    await ensureIsActorSelf(this.prisma, selfUserId, actorId);
    return this.prisma.actor.findUniqueOrThrow({ where: { id: actorId }, select: { welcomeMessage: true, birthdayMessage: true } });
  }

  async updateSettings(selfUserId: string, actorId: string, dto: UpdateGreetingsDto) {
    await ensureIsActorSelf(this.prisma, selfUserId, actorId);
    return this.prisma.actor.update({
      where: { id: actorId },
      data: { welcomeMessage: clean(dto.welcomeMessage), birthdayMessage: clean(dto.birthdayMessage) },
      select: { welcomeMessage: true, birthdayMessage: true },
    });
  }

  @Cron('0 9 * * *', { timeZone: 'Asia/Bangkok' })
  async scheduled() {
    if (this.config.get<string>('BIRTHDAY_GREETINGS_ENABLED') === 'false') return;
    const sent = await this.sendBirthdayGreetings().catch((error: unknown) => {
      this.logger.error(`생일 축하 메시지 실패: ${String(error)}`);
      return 0;
    });
    if (sent > 0) this.logger.log(`생일 축하 메시지 ${sent}건`);
  }

  /** 오늘 생일인 팬에게 축하 메시지를 만들고 푸시 — 만든 건수. 서버가 여러 대여도 (팬, 방, 연도)가 겹치면 먼저 만든 쪽만 보냄 */
  async sendBirthdayGreetings(now = new Date()): Promise<number> {
    const today = birthdayToday(now);
    const fans = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User"
      WHERE "birthdayGreetingsEnabled" = true AND "deletedAt" IS NULL AND status = ${UserStatus.ACTIVE}::"UserStatus"
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${today.month}
        AND EXTRACT(DAY FROM "birthDate") = ANY(${today.days})`;
    if (fans.length === 0) return 0;
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId: { in: fans.map((fan) => fan.id) },
        cancelledAt: null,
        actor: { retiredAt: null, birthdayMessage: { not: null } },
      },
      select: {
        actorId: true,
        user: { select: { id: true, nickname: true, displayName: true } },
        actor: { select: { chatDisplayName: true, birthdayMessage: true } },
      },
    });
    let created = 0;
    for (const { actorId, user, actor } of subscriptions) {
      try {
        await this.prisma.birthdayGreeting.create({
          data: { userId: user.id, actorId, year: today.year, body: personalize(actor.birthdayMessage ?? '', user.nickname ?? user.displayName) },
        });
      } catch {
        continue; // 이미 보냄(같은 해) — 다른 서버가 먼저 만들었거나 다시 돌린 경우
      }
      created += 1;
      await this.push.sendToUser(
        user.id,
        (recipient) => {
          const t = pushStrings(recipient.locale);
          return { title: t.birthdayTitle(actor.chatDisplayName), body: t.birthdayBody };
        },
        { type: 'birthday', actorId },
      );
    }
    return created;
  }
}
