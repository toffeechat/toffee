import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  // 요약 카드(2026-10-25) — 오늘 가입·구독 중·제재 중
  @IsOptional()
  @IsIn(['today', 'subscribed', 'sanctioned'])
  filter?: 'today' | 'subscribed' | 'sanctioned';
}
