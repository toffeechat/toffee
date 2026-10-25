import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { STATS_PERIODS, type StatsPeriod } from '../../actors/dto/agency-stats-query.dto.js';
import { Role } from '../../generated/prisma/enums.js';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  // 배우 본인 계정 연결·스태프 배정 화면에서 해당 역할 계정만 고를 때
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  // recent = 최근 접속순(2026-10-14, 데모 접속 확인용). 없으면 가입 최신순
  @IsOptional()
  @IsIn(['recent'])
  sort?: 'recent';

  // 몇 번째 쪽(1부터, 한 쪽 50명 — 2026-10-20)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // 기간 필터(2026-10-25, 운영자 홈 "오늘 가입·오늘 접속" 카드에서 넘어옴) — joined = 가입일, active = 마지막 접속이 그 기간.
  // 기간은 통계와 같은 규칙(최근 7·30·90일 또는 태국 날짜 from~to, 최대 1년, resolveRange)
  @IsOptional()
  @IsIn(['joined', 'active'])
  dateField?: 'joined' | 'active';

  @IsOptional()
  @Type(() => Number)
  @IsIn(STATS_PERIODS)
  days?: StatsPeriod;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
