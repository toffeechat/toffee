import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActorsService } from './actors.service.js';
import { AgencyStatsService, resolveRange } from './agency-stats.service.js';
import { AgencyRecordsService } from './agency-records.service.js';
import { ActorStatsQueryDto, AgencyDashboardQueryDto, AgencyRecordsQueryDto } from './dto/agency-stats-query.dto.js';
import { ListActorsQueryDto } from './dto/list-actors-query.dto.js';
import { CreateChatProfileUploadDto, SetChatProfileImageDto } from './dto/chat-profile-image.dto.js';
import { UpdateActorNicknameDto } from './dto/update-actor-nickname.dto.js';
import { UpdateActorStatusMessageDto } from './dto/update-actor-status-message.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

@Controller('actors')
export class ActorsController {
  constructor(
    private readonly actorsService: ActorsService,
    private readonly agencyStats: AgencyStatsService,
    private readonly agencyRecords: AgencyRecordsService,
  ) {}

  @Public()
  @Get()
  findAll(@Query() query: ListActorsQueryDto) {
    return this.actorsService.findAll(query.q, query.agencyId, query.sort, query.kind, query.gender);
  }

  // 'mine'은 ':id'보다 먼저 등록해야 함 — 안 그러면 "mine"이 id로 잡혀버림
  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.actorsService.findMine(user.id);
  }

  // 소속사 통계 대시보드(2026-10-12, 10-13 개편: 기간(최근 N일 또는 from~to)·아티스트/CP·추이·팬 나라/언어). 'mine/…'은 ':id'보다 먼저
  @Roles(Role.AGENCY_STAFF, Role.ADMIN)
  @Get('mine/dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: AgencyDashboardQueryDto) {
    return this.agencyStats.dashboard(user.id, resolveRange(query), query.kind, query.agencyId);
  }

  // 소속사 "기록"(2026-10-13) — 소속 아티스트 방의 차단·신고·메시지 삭제
  @Roles(Role.AGENCY_STAFF, Role.ADMIN)
  @Get('mine/records')
  records(@CurrentUser() user: AuthenticatedUser, @Query() query: AgencyRecordsQueryDto) {
    return this.agencyRecords.records(user.id, query.actorId);
  }

  // 이 배우가 든 커플방(배우 프로필 "커플방")
  @Public()
  @Get(':id/couples')
  couples(@Param('id') id: string) {
    return this.actorsService.couplesOf(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actorsService.findOne(id);
  }

  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @Get(':id/stats')
  getStats(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query() query: ActorStatsQueryDto) {
    return this.agencyStats.actorStats(user.id, id, resolveRange(query));
  }

  // 배우 닉네임(채팅방에 보이는 이름) — 배우 본인만(소속사는 발송 권한과 마찬가지로 대신 못 바꿈)
  @Roles(Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Patch(':id/nickname')
  updateNickname(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateActorNicknameDto) {
    return this.actorsService.updateNickname(user.id, id, dto.nickname);
  }

  // 상태메시지(2026-10-25) — 배우 본인만(커플방 id면 내 멤버 값). 운영자는 PATCH /admin/actors/:id/clear-status-message로 지우기만
  @Roles(Role.ACTOR)
  @Patch(':id/status-message')
  updateStatusMessage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateActorStatusMessageDto) {
    return this.actorsService.updateStatusMessage(user.id, id, dto.statusMessage);
  }

  // 대화방 사진 — 배우 본인·같은 소속사 직원·운영자(공식 사진·이름은 운영자 화면에서만, 2026-09-28 사용자 결정)
  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Post(':id/chat-profile-image/upload')
  createChatProfileUpload(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateChatProfileUploadDto) {
    return this.actorsService.createChatProfileUpload(user.id, id, dto.contentType, dto.sizeBytes);
  }

  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Patch(':id/chat-profile-image')
  setChatProfileImage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetChatProfileImageDto) {
    return this.actorsService.setChatProfileImage(user.id, id, dto.key);
  }

  // 토피룸 배경 사진(2026-10-14) — 대화방 사진과 같은 권한, 업로드는 chat-profile-image/upload를 같이 씀
  @Roles(Role.AGENCY_STAFF, Role.ACTOR, Role.ADMIN)
  @AdminOwnerOnly()
  @Patch(':id/chat-background')
  setChatBackground(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetChatProfileImageDto) {
    return this.actorsService.setChatBackground(user.id, id, dto.key);
  }
}
