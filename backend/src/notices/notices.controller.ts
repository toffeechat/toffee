import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { NoticesService } from './notices.service.js';
import { UpsertNoticeDto } from './dto/upsert-notice.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { TranslationService } from '../translation/translation.service.js';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../common/i18n/locales.js';

class TranslateNoticeDto {
  @IsIn(SUPPORTED_LOCALES)
  targetLanguage!: SupportedLocale;
}

@Controller()
export class NoticesController {
  constructor(
    private readonly noticesService: NoticesService,
    private readonly translation: TranslationService,
  ) {}

  // 로그인한 모든 계정(팬·아티스트·소속사) — 마이페이지 "공지사항"
  @Get('notices')
  list() {
    return this.noticesService.list();
  }

  // 번역 보기(2026-10-20) — 비용이 드는 호출이라 사람당 1분에 20번까지(번역은 공지 × 언어마다 한 번만 하고 저장)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('notices/:id/translate')
  @HttpCode(HttpStatus.OK)
  translate(@Param('id') id: string, @Body() dto: TranslateNoticeDto) {
    return this.translation.translateNotice(id, dto.targetLanguage);
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
