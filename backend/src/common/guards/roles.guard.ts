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
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(appError('FORBIDDEN'));
    }
    if (user.role === Role.ADMIN) {
      // 2단계 인증(2026-10-20) — 켠 운영자는 최근에 코드를 확인한 토큰이어야 운영자로 동작(코드 확인·설정 API는 예외)
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
