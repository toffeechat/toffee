import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminActorsService } from './admin-actors.service.js';
import { CreateActorDto, CreateCoupleDto, LinkActorUserDto, SetContractEndDto, SetRetireAtDto, SetRetiredDto, UpdateActorDto, UpdateActorImagesDto } from './dto/upsert-actor.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { ActorImportService } from './actor-import.service.js';
import { ImportActorsDto } from './dto/import-actors.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { CreateProfileUploadDto } from './dto/create-profile-upload.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

// 소속사 지정(이적)·이력은 AdminAgenciesController(PATCH /admin/actors/:id/agency) 쪽
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminActorsController {
  constructor(
    private readonly adminActorsService: AdminActorsService,
    private readonly audit: AuditService,
    private readonly actorImport: ActorImportService,
  ) {}

  @Get('actors')
  findAll(@Query() query: ListUsersQueryDto) {
    return this.adminActorsService.findAll(query.q);
  }

  @Get('actors/:id')
  findOne(@Param('id') id: string) {
    return this.adminActorsService.findOne(id);
  }

  // 아티스트 일괄 등록(2026-10-19) — dryRun이면 미리보기만. 'actors/import'는 'actors/:id'와 메서드가 달라 겹치지 않음
  @AdminOwnerOnly()
  @Post('actors/import')
  import(@CurrentUser() admin: AuthenticatedUser, @Body() dto: ImportActorsDto) {
    return this.actorImport.run(admin.id, dto);
  }

  @AdminOwnerOnly()
  @Post('actors')
  create(@Body() dto: CreateActorDto) {
    return this.adminActorsService.create(dto);
  }

  // 커플방 만들기(멤버 배우 2명)
  @AdminOwnerOnly()
  @Post('couples')
  createCouple(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCoupleDto) {
    return this.adminActorsService.createCouple(admin.id, dto);
  }

  @AdminOwnerOnly()
  @Patch('actors/:id')
  update(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateActorDto) {
    return this.adminActorsService.update(admin.id, id, dto);
  }

  @AdminOwnerOnly()
  @Patch('actors/:id/images')
  updateImages(@Param('id') id: string, @Body() dto: UpdateActorImagesDto) {
    return this.adminActorsService.updateImages(id, dto);
  }

  @AdminOwnerOnly()
  @Patch('actors/:id/retire')
  setRetired(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetRetiredDto) {
    return this.adminActorsService.setRetired(admin.id, id, dto.retired);
  }

  // 활동 종료 예정(2026-10-20) — retireAt(ISO) 또는 null(예정 취소)
  @AdminOwnerOnly()
  @Patch('actors/:id/retire-at')
  setRetireAt(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetRetireAtDto) {
    return this.adminActorsService.setRetireAt(admin.id, id, dto.retireAt ? new Date(dto.retireAt) : null);
  }

  // 계약 끝나는 날(2026-10-20) — 지나도 자동 종료 안 함, 홈 할 일·알림만
  @AdminOwnerOnly()
  @Patch('actors/:id/contract')
  setContract(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetContractEndDto) {
    return this.adminActorsService.setContractEnd(admin.id, id, dto.contractEndAt ? new Date(dto.contractEndAt) : null);
  }

  @Get('contracts-ending')
  contractsEnding() {
    return this.adminActorsService.contractsEnding();
  }

  // 운영자 작업 기록(최근 100건)
  @Get('actions')
  recentActions() {
    return this.audit.recent();
  }

  @AdminOwnerOnly()
  @Patch('actors/:id/self-user')
  linkUser(@Param('id') id: string, @Body() dto: LinkActorUserDto) {
    return this.adminActorsService.linkUser(id, dto.userId);
  }

  @AdminOwnerOnly()
  @Post('uploads')
  createUpload(@Body() dto: CreateProfileUploadDto) {
    return this.adminActorsService.createProfileUpload(dto.target, dto.targetId, dto.contentType, dto.sizeBytes);
  }
}
