import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ReleaseService } from './release.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// "곧 공개" 알림 받기(2026-10-19) — 팬만. 아티스트·CP방은 /actors/:id, 묶음은 /bundles/:id
@Roles(Role.USER)
@Controller()
export class ReleasesController {
  constructor(private readonly releases: ReleaseService) {}

  @Get('actors/:id/release-watch')
  actorStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') actorId: string) {
    return this.releases.status(user.id, { actorId });
  }

  @Post('actors/:id/release-watch')
  watchActor(@CurrentUser() user: AuthenticatedUser, @Param('id') actorId: string) {
    return this.releases.watch(user.id, { actorId });
  }

  @Delete('actors/:id/release-watch')
  unwatchActor(@CurrentUser() user: AuthenticatedUser, @Param('id') actorId: string) {
    return this.releases.unwatch(user.id, { actorId });
  }

  @Get('bundles/:id/release-watch')
  bundleStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') bundleId: string) {
    return this.releases.status(user.id, { bundleId });
  }

  @Post('bundles/:id/release-watch')
  watchBundle(@CurrentUser() user: AuthenticatedUser, @Param('id') bundleId: string) {
    return this.releases.watch(user.id, { bundleId });
  }

  @Delete('bundles/:id/release-watch')
  unwatchBundle(@CurrentUser() user: AuthenticatedUser, @Param('id') bundleId: string) {
    return this.releases.unwatch(user.id, { bundleId });
  }
}
