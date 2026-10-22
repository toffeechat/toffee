import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { Role } from '../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { RefundService, type RefundReason } from './refund.service.js';

class AdminRefundQueryDto {
  @IsOptional()
  @IsIn(['STAR_IDLE', 'ACTOR_RETIRED'])
  reason?: RefundReason;

  // 환불 처리 대기만(2026-10-22) — ?waiting=true
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  waiting?: boolean;
}

class CheckRefundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** 운영자 환불 요청 목록(2026-09-29) — 고객 문의 대응, 애플 안내 건의 실제 환불 여부, 배우·소속사별 환불 파악. 2026-10-22 환불 처리 대기·확인함 */
@Roles(Role.ADMIN)
@Controller('admin/refunds')
export class AdminRefundsController {
  constructor(
    private readonly refunds: RefundService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: AdminRefundQueryDto) {
    return this.refunds.adminList({ reason: query.reason, waiting: query.waiting });
  }

  // 운영자 홈 "처리할 일" 카드용 — 개수와 기준 날 수
  @Get('waiting-count')
  async waitingCount() {
    return { count: await this.refunds.waitingCount(), days: this.refunds.appleWaitDays };
  }

  @Patch(':id/checked')
  async check(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: CheckRefundDto) {
    const result = await this.refunds.markChecked(admin.id, id, dto.note);
    await this.audit.record(admin.id, 'REFUND_CHECK', 'REFUND', id, dto.note?.trim() ? { note: dto.note.trim() } : undefined);
    return result;
  }
}
