import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminLevel, Role, UserStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { appError } from '../../common/i18n/app-error.js';
import { AccessLogService } from '../../access-log/access-log.service.js';
import { DemoAccessService } from '../../demo/demo-access.service.js';
import { clientInfoFromRequest } from '../../access-log/client-info.js';
import { tokenSessionValid } from '../auth-sessions.js';

interface JwtPayload {
  sub: string;
  // 데모 입장 코드로 로그인했으면 그 코드 id(공용 코드는 'common') — 2026-10-19
  dac?: string;
  // 운영자 2단계 인증 코드를 확인한 시각(ms, 2026-10-20) — 운영자 API는 2단계 인증을 켠 계정이면 이게 최근이어야 함(RolesGuard)
  mfaAt?: number;
  // 로그인 세션 id·계정 토큰 버전(2026-10-27) — 로그아웃·모든 기기 로그아웃·제재 때 이미 나간 토큰을 막음(auth-sessions.ts)
  sid?: string;
  tv?: number;
  // 배포 점검용 짧은 토큰(2026-10-28) — /auth/refresh로 30일 세션을 받지 못하게
  short?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accessLog: AccessLogService,
    private readonly demoAccess: DemoAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      // 접속 기록에 기기 정보(X-Client-* 헤더)를 남기려고 요청도 받음
      passReqToCallback: true,
    });
  }

  // JWT에 담긴 role은 신뢰하지 않고, 매 요청마다 DB에서 최신 role을 다시 읽음
  // — 권한이 바뀌면(예: 소속사 스태프 지정) 재로그인 없이 바로 반영됨
  async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
    const sessionId = typeof payload.sid === 'string' ? payload.sid : undefined;
    const tokenVersion = typeof payload.tv === 'number' ? payload.tv : 0;
    // 세션도 같은 조회로(옛 토큰은 sid가 없어 빈 결과)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { authSessions: { where: { id: sessionId ?? '' }, select: { revokedAt: true, expiresAt: true } } },
    });
    if (!user) throw new UnauthorizedException();
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException(appError('ACCOUNT_BANNED', user.sanctionCategory ? { reason: user.sanctionCategory } : undefined));
    }
    if (user.deletedAt) throw new UnauthorizedException(appError('ACCOUNT_DELETED'));
    // 정지 기간이 지났으면 상태값은 그대로여도(별도 재활성화 없이) 다시 이용 가능하게 취급
    if (user.status === UserStatus.SUSPENDED && user.suspendedUntil && user.suspendedUntil > new Date()) {
      // 날짜는 받는 사람 언어로 표기(태국 시간) — 오류 문구 번역 때 포맷
      throw new UnauthorizedException(
        appError('ACCOUNT_SUSPENDED', { until: user.suspendedUntil.toISOString(), ...(user.sanctionCategory ? { reason: user.sanctionCategory } : {}) }),
      );
    }
    // 로그아웃·모든 기기 로그아웃·제재로 끊긴 토큰(2026-10-27) — 정지·탈퇴 안내가 먼저 보이게 그 뒤에 확인
    if (!tokenSessionValid({ sessionId, tokenVersion }, user)) throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    // 마지막 접속(통계·운영자 회원 관리) + 접속 기록 — 한 시간에 한 번만, 응답은 기다리지 않음
    const client = clientInfoFromRequest(req);
    // 소속사별 데모 입장 코드가 만료·중지됐으면 로그인 중이어도 내보냄(2026-10-19 사용자 결정) + 소속사별 접속 기록
    if (typeof payload.dac === 'string') {
      await this.demoAccess.assertActive(payload.dac);
      this.demoAccess.touch(payload.dac, user.role, 'VISIT', client);
    }
    this.accessLog.touchVisit(user.id, user.lastActiveAt, client);
    return {
      id: user.id,
      role: user.role,
      tokenVersion,
      ...(sessionId ? { sessionId } : {}),
      ...(typeof payload.dac === 'string' ? { demoCode: payload.dac } : {}),
      ...(payload.short === true ? { shortLived: true } : {}),
      ...(user.role === Role.ADMIN ? { adminLevel: user.adminLevel ?? AdminLevel.OWNER, mfaEnabled: !!user.totpEnabledAt, mfaAt: payload.mfaAt } : {}),
    };
  }
}
