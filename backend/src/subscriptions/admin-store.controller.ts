import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StoreRenewalService } from './store-renewal.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

class SaleStoppedDto {
  @IsBoolean()
  stopped!: boolean;
}

/** 애플 판매 중지 할 일(2026-10-20) — 운영자가 App Store Connect에서 판매 중지한 뒤 [판매 중지함] 표시 */
// 운영자 중 OWNER만(2026-10-20 권한 단계) — 고객 응대 운영자는 못 씀
@AdminOwnerOnly()
@Roles(Role.ADMIN)
@Controller('admin/store')
export class AdminStoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly renewals: StoreRenewalService,
  ) {}

  @Get('apple-todo')
  appleTodo() {
    return this.renewals.appleTodo();
  }

  @Patch('actors/:id/sale-stopped')
  async actorSaleStopped(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SaleStoppedDto) {
    await this.prisma.actor.update({ where: { id }, data: { storeSaleStoppedAt: dto.stopped ? new Date() : null } });
    await this.audit.record(admin.id, 'STORE_SALE_STOPPED', 'ACTOR', id, { stopped: dto.stopped });
    return { ok: true };
  }

  @Patch('bundles/:id/sale-stopped')
  async bundleSaleStopped(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SaleStoppedDto) {
    await this.prisma.bundle.update({ where: { id }, data: { storeSaleStoppedAt: dto.stopped ? new Date() : null } });
    await this.audit.record(admin.id, 'STORE_SALE_STOPPED', 'BUNDLE', id, { stopped: dto.stopped });
    return { ok: true };
  }
}
