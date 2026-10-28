import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * 로그인 세션(2026-10-27) — 토큰마다 AuthSession 한 줄(sid)과 계정의 tokenVersion(tv)을 담아서, 로그아웃·"모든 기기에서 로그아웃"·
 * 제재·2단계 인증 초기화 때 이미 나간 토큰을 바로 막음. 예전엔 30일짜리 토큰을 되돌릴 방법이 없었음.
 */

const DEFAULT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** JWT_EXPIRES_IN("30d", "12h", "15m"…)을 ms로 — 모듈의 서명 만료와 세션 만료를 맞춤. 단위가 없으면 jsonwebtoken처럼 ms, 못 읽으면 30일 */
export function jwtLifetimeMs(value: string | undefined | null): number {
  const match = /^\s*(\d+)\s*(ms|s|m|h|d|w)?\s*$/i.exec(value ?? '');
  if (!match) return DEFAULT_LIFETIME_MS;
  const ms = Number(match[1]) * UNIT_MS[(match[2] ?? 'ms').toLowerCase()];
  return ms > 0 ? ms : DEFAULT_LIFETIME_MS;
}

/**
 * user.update data에 끼워 넣는 "모든 로그인 끊기" — tv를 올려 세션 없는 옛 토큰까지 막고, 세션 기록도 끊긴 것으로(keepSessionId는 남김).
 * 푸시 기기도 지움(2026-10-28 점검) — 세션만 끊으면 잃어버린 폰 잠금화면에 메시지 미리보기 푸시가 계속 갔음. 로그아웃된 앱은 토큰이 무효라
 * 스스로 해제할 수 없음. 이 기기 세션을 남기는 경우(keepSessionId)는 어느 기기가 이 기기인지 몰라서 그대로(앱이 다음 실행 때 다시 등록)
 */
export function revokeAllSessionsData(now = new Date(), keepSessionId?: string) {
  return {
    tokenVersion: { increment: 1 },
    authSessions: {
      updateMany: { where: { revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) }, data: { revokedAt: now } },
    },
    ...(keepSessionId ? {} : { pushDevices: { deleteMany: {} } }),
  } satisfies Prisma.UserUpdateInput;
}

/** 이 계정의 모든 로그인을 끊고 새 tokenVersion을 돌려줌 */
export async function revokeAllSessions(db: PrismaService | Prisma.TransactionClient, userId: string, keepSessionId?: string): Promise<number> {
  const user = await db.user.update({ where: { id: userId }, data: revokeAllSessionsData(new Date(), keepSessionId), select: { tokenVersion: true } });
  return user.tokenVersion;
}

/**
 * 토큰이 아직 살아 있는지 — tv가 계정과 같고, sid가 있으면 그 세션이 끊기거나 만료되지 않았어야 함.
 * sid 없는 옛 토큰(이번 변경 전 로그인·배포 점검용 짧은 토큰)은 tv만 확인(앱이 /auth/refresh로 세션 있는 토큰으로 바꿈).
 * JwtStrategy와 실시간 연결(RealtimeController)이 같이 씀
 */
export function tokenSessionValid(
  token: { tokenVersion?: number; sessionId?: string },
  user: { tokenVersion: number; authSessions?: { revokedAt: Date | null; expiresAt: Date }[] },
  now = new Date(),
): boolean {
  if ((token.tokenVersion ?? 0) !== user.tokenVersion) return false;
  if (!token.sessionId) return true;
  const session = user.authSessions?.[0];
  return !!session && !session.revokedAt && session.expiresAt > now;
}
