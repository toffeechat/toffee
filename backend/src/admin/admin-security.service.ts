import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AdminLevel, Role } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';
import { revokeAllSessions, revokeAllSessionsData } from '../auth/auth-sessions.js';
import { generateTotpSecret, matchTotpStep, otpauthUrl, verifyTotp } from '../common/utils/totp.js';

// 코드 실패 잠금(2026-10-28 점검) — 예전엔 분당 5번씩 무한히 맞혀 볼 수 있어서 한 달이면 절반 가까운 확률로 뚫렸음
const MFA_MAX_FAILURES = 10;
const MFA_LOCK_MS = 15 * 60 * 1000;

/**
 * 운영자 2단계 인증(인증 앱 6자리 코드)·권한 단계(2026-10-20).
 * - 2단계 인증: 설정 → 코드 확인으로 켬. 켠 운영자는 로그인 뒤(그리고 ADMIN_MFA_HOURS마다) 코드를 확인해야 운영자 API가 열림 —
 *   확인하면 mfaAt이 담긴 새 토큰을 돌려줌(RolesGuard가 검사).
 * - 권한 단계: OWNER(전체) / SUPPORT(고객 응대 — 회원 제재·신고·금칙어·공지·환불·문의·통계 보기). 마지막 OWNER는 못 내림.
 */
@Injectable()
export class AdminSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true, adminLevel: true } });
    return { enabled: !!user.totpEnabledAt, enabledAt: user.totpEnabledAt, level: user.adminLevel ?? AdminLevel.OWNER };
  }

  /** 새 비밀키(아직 켜지지 않음) — 인증 앱에 넣고 코드로 확인해야 켜짐. 이미 켰으면 끄고 다시 */
  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, totpEnabledAt: true } });
    if (user.totpEnabledAt) throw new BadRequestException(appError('ADMIN_MFA_INVALID'));
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: secret } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email ?? userId) };
  }

  // sessionId: 지금 요청의 로그인 세션 — 같은 기기에서 이어서 쓰므로 새 세션을 만들지 않음(2026-10-27)
  async enable(userId: string, code: string, sessionId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, totpPendingSecret: true } });
    if (!user.totpPendingSecret || !verifyTotp(user.totpPendingSecret, code)) throw new BadRequestException(appError('ADMIN_MFA_INVALID'));
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null, totpEnabledAt: new Date() } });
    await this.audit.record(userId, 'ADMIN_MFA', 'USER', userId, { enabled: true });
    return this.auth.issueAccessToken(user, { mfaAt: Date.now(), sessionId });
  }

  /** 코드 확인 → mfaAt이 담긴 새 토큰 */
  async verify(userId: string, code: string, sessionId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, totpEnabledAt: true } });
    if (!user.totpEnabledAt) throw new BadRequestException(appError('ADMIN_MFA_INVALID'));
    await this.checkCode(userId, code);
    return this.auth.issueAccessToken(user, { mfaAt: Date.now(), sessionId });
  }

  /**
   * 켜진 2단계 인증 코드 확인 — 잠겨 있으면 거절, 틀리면 실패 횟수(10번이면 15분 잠금), 맞으면 그 코드의 시간 칸을 저장해서 같은 코드(±30초 창이라
   * 최대 90초 동안 유효)를 다시 못 쓰게. 저장은 조건부라 같은 코드로 동시에 두 번 와도 한 번만 통과
   */
  private async checkCode(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpFailedCount: true, totpLockedUntil: true, totpLastStep: true } });
    const now = new Date();
    if (user.totpLockedUntil && user.totpLockedUntil > now) throw new ForbiddenException(appError('ADMIN_MFA_LOCKED'));
    const step = user.totpSecret ? matchTotpStep(user.totpSecret, code, now.getTime()) : null;
    if (step !== null) {
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step, totpFailedCount: 0, totpLockedUntil: null },
      });
      if (count === 1) return;
    }
    const failures = user.totpFailedCount + 1;
    const locked = failures >= MFA_MAX_FAILURES;
    await this.prisma.user.update({
      where: { id: userId },
      data: locked ? { totpFailedCount: 0, totpLockedUntil: new Date(now.getTime() + MFA_LOCK_MS) } : { totpFailedCount: { increment: 1 } },
    });
    if (locked) {
      await this.audit.record(userId, 'ADMIN_MFA', 'USER', userId, { locked: true });
      throw new ForbiddenException(appError('ADMIN_MFA_LOCKED'));
    }
    throw new BadRequestException(appError('ADMIN_MFA_INVALID'));
  }

  /** 끄기 — 지금 코드를 한 번 더 확인(토큰을 훔쳐도 끌 수 없게). 다른 기기 로그인은 모두 끊고 이 기기만 새 토큰으로(2026-10-27) */
  async disable(userId: string, code: string, sessionId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, totpSecret: true } });
    if (!user.totpSecret) throw new BadRequestException(appError('ADMIN_MFA_INVALID'));
    await this.checkCode(userId, code);
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null } });
    await revokeAllSessions(this.prisma, userId, sessionId);
    await this.audit.record(userId, 'ADMIN_MFA', 'USER', userId, { enabled: false });
    return this.auth.issueAccessToken(user, { sessionId });
  }

  // ── OWNER만: 운영자 목록·권한 단계·2단계 인증 초기화(폰 분실) ──

  async listAdmins() {
    const rows = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      select: { id: true, displayName: true, nickname: true, email: true, status: true, adminLevel: true, totpEnabledAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ adminLevel, totpEnabledAt, ...row }) => ({ ...row, level: adminLevel ?? AdminLevel.OWNER, mfaEnabled: !!totpEnabledAt }));
  }

  async setLevel(actorId: string, targetId: string, level: AdminLevel) {
    const target = await this.requireAdmin(targetId);
    const current = target.adminLevel ?? AdminLevel.OWNER;
    if (current === level) return this.listAdmins();
    if (current === AdminLevel.OWNER && level !== AdminLevel.OWNER) {
      const owners = await this.prisma.user.count({ where: { role: Role.ADMIN, deletedAt: null, OR: [{ adminLevel: null }, { adminLevel: AdminLevel.OWNER }] } });
      if (owners <= 1) throw new ForbiddenException(appError('ADMIN_LAST_OWNER'));
    }
    await this.prisma.user.update({ where: { id: targetId }, data: { adminLevel: level } });
    await this.audit.record(actorId, 'ADMIN_LEVEL', 'USER', targetId, { from: current, to: level });
    return this.listAdmins();
  }

  async resetMfa(actorId: string, targetId: string) {
    await this.requireAdmin(targetId);
    // 폰을 잃어버린 경우라 그 운영자의 모든 로그인도 끊음(2026-10-27) — 다시 로그인해서 새로 설정
    await this.prisma.user.update({
      where: { id: targetId },
      data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpFailedCount: 0, totpLockedUntil: null, ...revokeAllSessionsData() },
    });
    await this.audit.record(actorId, 'ADMIN_MFA', 'USER', targetId, { reset: true });
    return this.listAdmins();
  }

  private async requireAdmin(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true, adminLevel: true } });
    if (!user || user.role !== Role.ADMIN) throw new NotFoundException(appError('NOT_FOUND'));
    return user;
  }
}
