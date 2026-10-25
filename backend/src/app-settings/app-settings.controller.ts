import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsBoolean, IsDateString, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { AppSettingsService } from './app-settings.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const VERSION = /^\d+(\.\d+){0,2}$/;

class UpdateAppSettingsDto {
  @IsOptional()
  @IsBoolean()
  maintenanceOn?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  maintenanceMessage?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  maintenanceUntil?: string | null;

  // "1.2.0"처럼(비우면 검사 안 함)
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(VERSION)
  minVersionIos?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(VERSION)
  minVersionAndroid?: string | null;
}

@Controller()
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}

  // 앱이 켤 때·다시 볼 때마다 — 점검 중인지, 최소 버전(2026-10-20). 로그인 전에도
  @Public()
  @Get('app-config')
  publicConfig() {
    return this.settings.publicConfig();
  }

  @Roles(Role.ADMIN)
  @AdminOwnerOnly()
  @Get('admin/app-settings')
  get() {
    return this.settings.adminView();
  }

  @Roles(Role.ADMIN)
  @AdminOwnerOnly()
  @Patch('admin/app-settings')
  update(@CurrentUser() admin: AuthenticatedUser, @Body() dto: UpdateAppSettingsDto) {
    return this.settings.update(admin.id, dto);
  }
}
