import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AdminAgenciesService } from './admin-agencies.service.js';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/upsert-agency.dto.js';
import { AssignAgencyDto } from './dto/assign-agency.dto.js';
import { FoundingShareDto, SetShareRateDto } from './dto/share-rate.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

// 운영자 중 OWNER만(2026-10-20 권한 단계) — 고객 응대 운영자는 못 씀
@AdminOwnerOnly()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminAgenciesController {
  constructor(private readonly adminAgenciesService: AdminAgenciesService) {}

  @Get('agencies')
  findAll() {
    return this.adminAgenciesService.findAll();
  }

  @Post('agencies')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAgencyDto) {
    return this.adminAgenciesService.create(user.id, dto);
  }

  @Patch('agencies/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.adminAgenciesService.update(user.id, id, dto);
  }

  // 배분율 이력(2026-10-27) — 정산은 결제가 속한 달의 비율로. 마감한 달은 못 바꿈
  @Get('agencies/:id/share-rates')
  shareRates(@Param('id') id: string) {
    return this.adminAgenciesService.shareRates(id);
  }

  @Post('agencies/:id/share-rates')
  setShareRate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetShareRateDto) {
    return this.adminAgenciesService.setShareRate(user.id, id, dto);
  }

  @Post('agencies/:id/share-rates/founding')
  applyFoundingShare(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: FoundingShareDto) {
    return this.adminAgenciesService.applyFoundingShare(user.id, id, dto);
  }

  @Delete('agencies/:id/share-rates/:fromMonth')
  deleteShareRate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('fromMonth') fromMonth: string) {
    return this.adminAgenciesService.deleteShareRate(user.id, id, fromMonth);
  }

  @Patch('actors/:id/agency')
  assignActor(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignAgencyDto) {
    return this.adminAgenciesService.assignActor(user.id, id, dto.agencyId);
  }

  @Get('actors/:id/agency-history')
  actorHistory(@Param('id') id: string) {
    return this.adminAgenciesService.actorHistory(id);
  }

  @Patch('users/:id/agency')
  assignStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignAgencyDto) {
    return this.adminAgenciesService.assignStaff(user.id, id, dto.agencyId);
  }
}
