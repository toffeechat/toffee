import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrivacyExportService } from './privacy-export.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageUser } from '../admin/admin-users.service.js';

// 내 정보 받기(2026-10-20, PDPA) — 로그인한 누구나 자기 것. 무거운 조회라 1분에 3번
@Controller('auth/me')
export class PrivacyController {
  constructor(private readonly exporter: PrivacyExportService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('export')
  exportMine(@CurrentUser() user: AuthenticatedUser) {
    return this.exporter.build(user.id);
  }
}

// 운영자가 회원 요청(메일·1:1 문의)을 대신 처리할 때 — 작업 기록에 남김
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminPrivacyController {
  constructor(
    private readonly exporter: PrivacyExportService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // 운영자 계정의 정보는 OWNER만 받음(2026-10-27 — 고객 응대 운영자가 다른 운영자 정보를 꺼내던 구멍)
  @Get(':id/export')
  async exportUser(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    await assertCanManageUser(this.prisma, admin, id);
    const data = await this.exporter.build(id);
    await this.audit.record(admin.id, 'USER_EXPORT', 'USER', id, {});
    return data;
  }
}
