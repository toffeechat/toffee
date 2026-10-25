import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { CURRENT_TERMS_VERSION } from '../common/legal/terms.js';
import { SMOKE_IDS } from './smoke-ids.js';

export interface SmokeSession {
  actorId: string;
  fanToken: string;
  artistToken: string;
}

const sameSecret = (given: string, expected: string) => {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given.trim()), digest(expected));
};

/**
 * 배포 후 자동 점검(2026-10-25, docs/engineering/deploy-runbook.md) — GitHub Actions가 배포 직후 "로그인 → 메시지 보내기 → 받기 → 답장"을
 * 실제 API로 한 바퀴 돌 수 있게 점검 전용 계정 둘(아티스트·팬)과 숨긴 대화방 하나를 만들고 10분짜리 토큰을 줌.
 * - SMOKE_TEST_SECRET이 없으면 라우트가 404(로컬·설정 전 서버). 운영 서버도 같은 방식(운영엔 테스트 로그인이 없어서).
 * - 대화방은 "활동 종료" 상태라 둘러보기·검색·구독에 안 보이고, 소속사도 없어서 소속사 화면·정산에 안 잡힘. 구독도 결제 없이(구매 기록 없음).
 * - 이 비밀값으로 들어갈 수 있는 건 이 두 계정뿐(역할 USER·ACTOR, 이 대화방만) — 새면 Railway·GitHub에서 값만 바꾸면 됨.
 */
@Injectable()
export class SmokeService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async session(secret: string | undefined): Promise<SmokeSession> {
    const expected = this.configService.get<string>('SMOKE_TEST_SECRET')?.trim();
    if (!expected) throw new NotFoundException();
    if (!secret || !sameSecret(secret, expected)) throw new UnauthorizedException();
    await this.prisma.$transaction((tx) => ensureSmokeRoom(tx));
    const [fanToken, artistToken] = await Promise.all([
      this.authService.issueShortAccessToken({ id: SMOKE_IDS.fanUser, role: Role.USER }, '10m'),
      this.authService.issueShortAccessToken({ id: SMOKE_IDS.artistUser, role: Role.ACTOR }, '10m'),
    ]);
    return { actorId: SMOKE_IDS.actor, fanToken, artistToken };
  }
}

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// 있으면 점검에 필요한 값만 되돌리고(운영자가 정지·역할 변경을 했어도 점검이 돌게), 없으면 만듦
async function ensureSmokeRoom(tx: Tx): Promise<void> {
  const agreed = { termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() };
  const healthy = { status: UserStatus.ACTIVE, suspendedUntil: null, bannedAt: null, deletedAt: null };
  const users = [
    { id: SMOKE_IDS.artistUser, role: Role.ACTOR, displayName: 'Smoke Test Artist', email: 'smoke-artist@system.toffeechat.app' },
    { id: SMOKE_IDS.fanUser, role: Role.USER, displayName: 'Smoke Test Fan', email: 'smoke-fan@system.toffeechat.app' },
  ];
  for (const { id, role, displayName, email } of users) {
    // 번역은 끔(점검 메시지로 번역 API 비용이 나가지 않게), 알림도 끔
    const fixed = { role, ...healthy, agencyId: null, autoTranslate: false, notifyArtistMessages: false, notifyIdleAlerts: false };
    await tx.user.upsert({
      where: { id },
      update: fixed,
      create: { id, displayName, email, locale: 'en', birthDate: new Date('2000-01-01'), replyRulesAcceptedAt: new Date(), ...agreed, ...fixed },
    });
  }
  const greetings = { welcomeMessage: 'Smoke test room', birthdayMessage: 'Smoke test room' };
  await tx.actor.upsert({
    where: { id: SMOKE_IDS.actor },
    update: { selfUserId: SMOKE_IDS.artistUser, agencyId: null, retiredAt: new Date(0), retireAt: null, releaseAt: null, ...greetings },
    create: {
      id: SMOKE_IDS.actor,
      legalName: 'Smoke Test (system)',
      chatDisplayName: 'Smoke Test',
      monthlyPriceCents: 0,
      selfUserId: SMOKE_IDS.artistUser,
      retiredAt: new Date(0),
      ...greetings,
    },
  });
  await tx.subscription.upsert({
    where: { userId_actorId: { userId: SMOKE_IDS.fanUser, actorId: SMOKE_IDS.actor } },
    update: { cancelledAt: null, notificationsMuted: true },
    create: { userId: SMOKE_IDS.fanUser, actorId: SMOKE_IDS.actor, startedAt: new Date(0), notificationsMuted: true },
  });
  // 점검 때마다 쌓이는 메시지는 하루 지난 것부터 지움(보관 기간 정리와 별개로 — 대화방이 끝없이 길어지지 않게)
  await tx.message.deleteMany({ where: { actorId: SMOKE_IDS.actor, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}
