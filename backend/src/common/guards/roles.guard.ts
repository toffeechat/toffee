import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { ADMIN_OWNER_KEY, SKIP_MFA_KEY } from '../decorators/admin-access.decorator.js';
import { AdminLevel, Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';
import { appError } from '../i18n/app-error.js';

/** 운영자 2단계 인증 확인이 유효한 시간(기본 12시간) — 지나면 코드를 다시 */
export const ADMIN_MFA_TTL_MS = Math.max(1, Number(process.env.ADMIN_MFA_HOURS ?? 12) || 12) * 60 * 60 * 1000;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    // 공개 라우트(@Public)는 user가 없음 — 그땐 역할·2단계 인증 확인할 것이 없음
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;

    if (requiredRoles && requiredRoles.length > 0 && (!user || !requiredRoles.includes(user.role))) {
      throw new ForbiddenException(appError('FORBIDDEN'));
    }
    if (user?.role === Role.ADMIN) {
      // 2단계 인증(2026-10-20) — 켠 운영자는 최근에 코드를 확인한 토큰이어야 운영자로 동작(코드 확인·설정 API는 예외).
      // 2026-10-27: @Roles가 붙은 운영자 API에서만 확인하던 것 → 운영자 계정의 모든 로그인 요청에서. 메시지·정산·신고처럼 @Roles 없이
      // 서비스 안에서 "운영자면 전체" 권한을 주는 API가 많아서, 코드 확인 전 토큰으로 그쪽을 다 쓸 수 있었음.
      // 코드 화면 전에 꼭 필요한 것(/auth/me·푸시 기기 등록·해제·2단계 인증 API)만 @SkipAdminMfa
      if (user.mfaEnabled && !this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, targets)) {
        if (!user.mfaAt || Date.now() - user.mfaAt > ADMIN_MFA_TTL_MS) throw new UnauthorizedException(appError('ADMIN_MFA_REQUIRED'));
      }
      // 권한 단계 — 고객 응대 운영자는 정산·소속사·아티스트 등록/가격·앱 설정·운영자 관리 같은 API를 못 씀
      if (user.adminLevel === AdminLevel.SUPPORT && this.reflector.getAllAndOverride<boolean>(ADMIN_OWNER_KEY, targets)) {
        throw new ForbiddenException(appError('ADMIN_OWNER_ONLY'));
      }
    }
    return true;
  }
}
