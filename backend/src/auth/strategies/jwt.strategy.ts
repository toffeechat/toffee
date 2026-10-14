import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { appError } from '../../common/i18n/app-error.js';
import { AccessLogService } from '../../access-log/access-log.service.js';
import { clientInfoFromRequest } from '../../access-log/client-info.js';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accessLog: AccessLogService,
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
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
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
    // 마지막 접속(통계·운영자 회원 관리) + 접속 기록 — 한 시간에 한 번만, 응답은 기다리지 않음
    this.accessLog.touchVisit(user.id, user.lastActiveAt, clientInfoFromRequest(req));
    return { id: user.id, role: user.role };
  }
}
