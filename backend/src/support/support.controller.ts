import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { INQUIRY_CATEGORIES, INQUIRY_PHOTO_MAX, SupportService, type InquiryCategory } from './support.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { InquiryStatus, Role } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

// 추가 질문·답변은 사진만 보내도 됨(글도 사진도 없으면 서비스가 INQUIRY_EMPTY)
class InquiryMessageDto {
  @IsString()
  @MaxLength(2000)
  body!: string;

  // POST support/uploads로 받은 objectKey(2026-10-25)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(INQUIRY_PHOTO_MAX)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  photoKeys?: string[];
}

// 새 문의는 내용 필수
class CreateInquiryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(INQUIRY_PHOTO_MAX)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  photoKeys?: string[];

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

  @IsOptional()
  @IsIn(INQUIRY_CATEGORIES)
  category?: InquiryCategory;
}

class InquiryPhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
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

  // 문의 사진 올리기(2026-10-25) — 회원·운영자 공통, 쓴 사람 경로로. 사진만(20MB까지)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('support/uploads')
  createPhotoUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: InquiryPhotoUploadDto) {
    return this.support.createPhotoUpload(user.id, dto.contentType, dto.sizeBytes);
  }

  @Get('support/inquiries/:id')
  findMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.support.findMine(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('support/inquiries/:id/messages')
  addMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: InquiryMessageDto) {
    return this.support.addMine(user.id, id, dto.body, dto.photoKeys);
  }

  @Delete('support/inquiries/:id')
  deleteMine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.support.deleteMine(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/inquiries')
  adminList(@Query() query: ListInquiriesDto) {
    return this.support.adminList(query.status, query.category);
  }

  @Roles(Role.ADMIN)
  @Get('admin/inquiries/:id')
  adminFind(@Param('id') id: string) {
    return this.support.adminFind(id);
  }

  @Roles(Role.ADMIN)
  @Post('admin/inquiries/:id/messages')
  adminReply(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: InquiryMessageDto) {
    return this.support.adminReply(admin.id, id, dto.body, dto.photoKeys);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/inquiries/:id/close')
  adminClose(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.support.adminClose(admin.id, id);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/inquiries/:id')
  adminDelete(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.support.adminDelete(admin.id, id);
  }
}
