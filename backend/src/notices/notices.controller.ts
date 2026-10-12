import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { NoticesService } from './notices.service.js';
import { UpsertNoticeDto } from './dto/upsert-notice.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Controller()
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  // 로그인한 모든 계정(팬·아티스트·소속사) — 마이페이지 "공지사항"
  @Get('notices')
  list() {
    return this.noticesService.list();
  }

  @Roles(Role.ADMIN)
  @Post('admin/notices')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertNoticeDto) {
    return this.noticesService.create(user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/notices/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpsertNoticeDto) {
    return this.noticesService.update(user.id, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/notices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.noticesService.remove(user.id, id);
  }
}
