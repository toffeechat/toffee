import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { INQUIRY_CATEGORIES, SupportService, type InquiryCategory } from './support.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { InquiryStatus, Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

class InquiryMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}

class CreateInquiryDto extends InquiryMessageDto {
  @IsIn(INQUIRY_CATEGORIES)
  category!: InquiryCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;
}

class ListInquiriesDto {
  @IsOptional()
  @IsIn(Object.values(InquiryStatus))
  status?: InquiryStatus;
}

@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // 로그인한 누구나(팬·아티스트·소속사) — 내 문의
  @Get('support/inquiries')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('support/inquiries')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInquiryDto) {
    return this.support.create(user.id, dto);
  }

  @Get('support/inquiries/:id')
  findMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.support.findMine(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('support/inquiries/:id/messages')
  addMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: InquiryMessageDto) {
    return this.support.addMine(user.id, id, dto.body);
  }

  @Roles(Role.ADMIN)
  @Get('admin/inquiries')
  adminList(@Query() query: ListInquiriesDto) {
    return this.support.adminList(query.status);
  }

  @Roles(Role.ADMIN)
  @Get('admin/inquiries/:id')
  adminFind(@Param('id') id: string) {
    return this.support.adminFind(id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/inquiries/:id/messages')
  adminReply(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: InquiryMessageDto) {
    return this.support.adminReply(admin.id, id, dto.body);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/inquiries/:id/close')
  adminClose(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.support.adminClose(admin.id, id);
  }
}
