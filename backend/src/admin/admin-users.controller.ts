import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { SanctionReasonDto, SuspendUserDto } from './dto/suspend-user.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';

@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.findAll(query.q, query.role, query.sort, query.page);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  // 접속 기록(2026-10-14)
  @Get(':id/access-logs')
  accessLogs(@Param('id') id: string) {
    return this.adminUsersService.accessLogs(id);
  }

  @Patch(':id/role')
  changeRole(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.adminUsersService.changeRole(admin.id, id, dto.role);
  }

  @Patch(':id/suspend')
  suspend(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminUsersService.suspend(admin.id, id, new Date(dto.until), { category: dto.category, note: dto.note });
  }

  @Patch(':id/ban')
  ban(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SanctionReasonDto) {
    return this.adminUsersService.ban(admin.id, id, { category: dto.category, note: dto.note });
  }

  // 팬 프로필 사진·상태메시지 지우기(2026-10-12)
  @Patch(':id/clear-profile')
  clearProfile(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminUsersService.clearProfile(admin.id, id);
  }

  @Patch(':id/reactivate')
  reactivate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminUsersService.reactivate(admin.id, id);
  }
}
