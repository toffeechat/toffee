import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto.js';
import { DAY_MS, zoneDayStart } from '../common/utils/stats-time.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto.messageId, dto.category, dto.reason);
  }

  // 운영자 신고 화면(2026-10-20) — 상태·사유·소속사·아티스트·기간(태국 날짜, 양 끝 포함) 필터 + 상태별 개수. 'admin'은 ':id'보다 먼저
  @Roles(Role.ADMIN)
  @Get('admin')
  findForAdmin(@Query() query: AdminReportsQueryDto) {
    return this.reportsService.findForAdmin({
      status: query.status,
      category: query.category,
      agencyId: query.agencyId,
      actorId: query.actorId,
      from: query.from ? zoneDayStart(query.from) ?? undefined : undefined,
      to: query.to ? new Date((zoneDayStart(query.to)?.getTime() ?? 0) + DAY_MS) : undefined,
    });
  }

  @Roles(Role.ADMIN)
  @Patch(':id/resolve')
  resolve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.reportsService.resolve(id, admin.id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/dismiss')
  dismiss(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.reportsService.dismiss(id, admin.id);
  }
}
