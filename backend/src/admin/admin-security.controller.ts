import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString, Length } from 'class-validator';
import { AdminSecurityService } from './admin-security.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminOwnerOnly, SkipAdminMfa } from '../common/decorators/admin-access.decorator.js';
import { AdminLevel, Role } from '../generated/prisma/enums.js';

class MfaCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

class SetAdminLevelDto {
  @IsIn(Object.values(AdminLevel))
  level!: AdminLevel;
}

// 운영자 2단계 인증·권한 단계(2026-10-20)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminSecurityController {
  constructor(private readonly security: AdminSecurityService) {}

  @SkipAdminMfa()
  @Get('mfa')
  status(@CurrentUser() admin: AuthenticatedUser) {
    return this.security.status(admin.id);
  }

  // 켜기 전(아직 2단계 인증이 없음)이라 확인 없이. 이미 켠 계정은 서비스가 거절
  @SkipAdminMfa()
  @Post('mfa/setup')
  setup(@CurrentUser() admin: AuthenticatedUser) {
    return this.security.setup(admin.id);
  }

  @SkipAdminMfa()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('mfa/enable')
  enable(@CurrentUser() admin: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.security.enable(admin.id, dto.code, admin.sessionId);
  }

  @SkipAdminMfa()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('mfa/verify')
  verify(@CurrentUser() admin: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.security.verify(admin.id, dto.code, admin.sessionId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('mfa/disable')
  disable(@CurrentUser() admin: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.security.disable(admin.id, dto.code, admin.sessionId);
  }

  @AdminOwnerOnly()
  @Get('admins')
  listAdmins() {
    return this.security.listAdmins();
  }

  @AdminOwnerOnly()
  @Patch('admins/:id/level')
  setLevel(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetAdminLevelDto) {
    return this.security.setLevel(admin.id, id, dto.level);
  }

  // 폰을 잃어버린 운영자 — 다른 OWNER가 초기화하면 다시 설정
  @AdminOwnerOnly()
  @Delete('admins/:id/mfa')
  resetMfa(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.security.resetMfa(admin.id, id);
  }
}
