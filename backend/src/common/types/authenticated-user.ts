import { AdminLevel, Role } from '../../generated/prisma/enums.js';

/** JwtStrategy가 req.user에 심는 값 — DB 풀 로드가 아니라 인가에 필요한 최소한만 */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  /** 운영자 권한 단계(2026-10-20) — 운영자가 아니면 없음, 운영자인데 값이 없으면 OWNER */
  adminLevel?: AdminLevel;
  /** 이 계정이 2단계 인증을 켰나 / 이 토큰이 코드를 확인한 시각(ms) */
  mfaEnabled?: boolean;
  mfaAt?: number;
}
