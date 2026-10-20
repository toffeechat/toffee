import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ActorLinksService } from './actor-links.service.js';
import { IssueActorLinksDto } from './dto/issue-actor-links.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

// 운영자: 아티스트 계정 연결 링크 만들기(여러 명)·취소(2026-10-19). 1차는 운영자만(소속사 직원 발급은 2차)
// 운영자 중 OWNER만(2026-10-20 권한 단계) — 고객 응대 운영자는 못 씀
@AdminOwnerOnly()
@Roles(Role.ADMIN)
@Controller('admin/actors')
export class AdminActorLinksController {
  constructor(private readonly links: ActorLinksService) {}

  @Post('link-tokens')
  issue(@CurrentUser() admin: AuthenticatedUser, @Body() dto: IssueActorLinksDto) {
    return this.links.issue(admin.id, dto.actorIds);
  }

  @Delete(':id/link-token')
  revoke(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.links.revoke(admin.id, id);
  }
}

// 아티스트가 링크를 연 화면 — 미리보기는 로그인 전에도(누구의 링크인지), 연결은 로그인한 계정으로. 토큰 맞히기 시도를 막으려고 횟수 제한
@Controller('actor-links')
export class ActorLinksController {
  constructor(private readonly links: ActorLinksService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.links.preview(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/claim')
  claim(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string) {
    return this.links.claim(user.id, token);
  }
}
