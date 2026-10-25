import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { DemoAccessService } from './demo-access.service.js';
import { CreateDemoCodeDto, UpdateDemoCodeDto } from './dto/demo-code.dto.js';
import { AdminOwnerOnly } from '../common/decorators/admin-access.decorator.js';

// 운영자 화면 "데모 입장 코드"(2026-10-19) — 코드는 지우지 않고 중지만(접속 기록 보존)
// 운영자 중 OWNER만(2026-10-20 권한 단계) — 고객 응대 운영자는 못 씀
@AdminOwnerOnly()
@Roles(Role.ADMIN)
@Controller('admin/demo-codes')
export class DemoAccessController {
  constructor(private readonly demoAccess: DemoAccessService) {}

  @Get()
  list() {
    return this.demoAccess.list();
  }

  @Post()
  create(@Body() dto: CreateDemoCodeDto) {
    return this.demoAccess.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDemoCodeDto) {
    return this.demoAccess.update(id, dto);
  }

  // 코드는 그대로 두고 접속 기록·첫 접속·방문 횟수만 지움(2026-10-25)
  @Post(':id/reset-stats')
  async resetStats(@Param('id') id: string) {
    await this.demoAccess.resetStats(id);
    return { ok: true };
  }

  // id 자리에 'common'이면 공용 코드(내부) 기록
  @Get(':id/events')
  events(@Param('id') id: string) {
    return this.demoAccess.events(id);
  }
}
