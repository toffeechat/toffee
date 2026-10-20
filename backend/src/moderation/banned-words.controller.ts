import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { BannedWordsService } from './banned-words.service.js';
import { AddDefaultBannedWordsDto, CreateBannedWordDto, TestBannedWordsDto } from './dto/create-banned-word.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Roles(Role.ADMIN)
@Controller('admin/banned-words')
export class BannedWordsController {
  constructor(private readonly bannedWordsService: BannedWordsService) {}

  @Get()
  findAll() {
    return this.bannedWordsService.findAll();
  }

  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateBannedWordDto) {
    return this.bannedWordsService.create(admin.id, dto);
  }

  // 기본 목록 넣기·테스트(2026-10-20) — ':id'와 메서드가 달라 겹치지 않음
  @Post('defaults')
  addDefaults(@CurrentUser() admin: AuthenticatedUser, @Body() dto: AddDefaultBannedWordsDto) {
    return this.bannedWordsService.addDefaults(admin.id, dto.language);
  }

  @Post('test')
  test(@Body() dto: TestBannedWordsDto) {
    return this.bannedWordsService.test(dto.text);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.bannedWordsService.remove(admin.id, id);
  }
}
