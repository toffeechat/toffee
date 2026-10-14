import { IsIn, IsOptional, IsString } from 'class-validator';
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
}
