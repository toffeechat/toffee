import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppSettingsService } from './app-settings.service.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { appError } from '../common/i18n/app-error.js';

// 점검 중에도 열어 두는 길 — 로그인(운영자가 들어와서 끌 수 있게)·앱 설정·헬스체크·스토어 결제 알림(결제 기록이 빠지지 않게)
const ALWAYS_OPEN = ['/auth', '/app-config', '/health', '/iap/'];

/**
 * 점검 모드(2026-10-20) — 켜져 있으면 운영자가 아닌 로그인 요청은 503 MAINTENANCE(앱은 점검 화면). 공개 API(둘러보기 등)는 앱이 어차피 점검 화면을
 * 보여 줘서 그대로 둠. JWT 가드 뒤에 돌아서 req.user가 있음.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: AppSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user?.role === Role.ADMIN) return true;
    const path = request.path ?? request.url ?? '';
    if (ALWAYS_OPEN.some((prefix) => path.startsWith(prefix))) return true;
    if (await this.settings.maintenanceActive()) throw new ServiceUnavailableException(appError('MAINTENANCE'));
    return true;
  }
}
