import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { SanctionReasonDto, SuspendUserDto } from './dto/suspend-user.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { rangeBounds, resolveRange } from '../actors/agency-stats.service.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.findAll(query.q, query.role, query.sort, query.page, query.dateField ? { field: query.dateField, ...rangeBounds(resolveRange(query)) } : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  // 구독·결제·환불 내역(2026-10-20)
  @Get(':id/billing')
  billing(@Param('id') id: string) {
    return this.adminUsersService.billing(id);
  }

  // 팬 한 명 기준 보기 — 답장·신고·차단·제재(2026-10-22)
  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.adminUsersService.activity(id);
  }

  // 접속 기록(2026-10-14)
  @Get(':id/access-logs')
  accessLogs(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminUsersService.accessLogs(admin, id);
  }

  @AdminOwnerOnly()
  @Patch(':id/role')
  changeRole(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.adminUsersService.changeRole(admin.id, id, dto.role);
  }

  // 제재 계열(2026-10-27) — 운영자 계정이 대상이면 OWNER만, 자기 자신·마지막 OWNER 정지·차단은 막음(assertCanManageUser)
  @Patch(':id/suspend')
  suspend(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminUsersService.suspend(admin, id, new Date(dto.until), { category: dto.category, note: dto.note });
  }

  @Patch(':id/ban')
  ban(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SanctionReasonDto) {
    return this.adminUsersService.ban(admin, id, { category: dto.category, note: dto.note });
  }

  // 팬 프로필 사진·상태메시지 지우기(2026-10-12)
  @Patch(':id/clear-profile')
  clearProfile(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminUsersService.clearProfile(admin, id);
  }

  @Patch(':id/reactivate')
  reactivate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminUsersService.reactivate(admin, id);
  }
}
