import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { ReportCategory, ReportStatus } from '../../generated/prisma/enums.js';

// 운영자 신고 화면 필터(2026-10-20) — 참조 ID는 @IsString, 날짜는 태국 날짜 YYYY-MM-DD(양 끝 포함)
export class AdminReportsQueryDto {
  @IsOptional()
  @IsIn(Object.values(ReportStatus))
  status?: ReportStatus;

  @IsOptional()
  @IsIn(Object.values(ReportCategory))
  category?: ReportCategory;

  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
