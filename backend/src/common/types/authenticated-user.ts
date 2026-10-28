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
  /** 로그인 세션(2026-10-27) — 토큰의 sid(옛 토큰엔 없음)·tv·데모 입장 코드. 토큰 갱신·로그아웃·실시간 연결 확인에 씀 */
  sessionId?: string;
  tokenVersion?: number;
  demoCode?: string;
  /** 배포 점검용 짧은 토큰(2026-10-28) — 토큰 갱신(30일 세션) 불가 */
  shortLived?: boolean;
}
