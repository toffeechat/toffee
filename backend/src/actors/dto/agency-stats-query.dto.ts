import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

// 소속사 대시보드·아티스트별 통계의 기간(일) — 앱의 [7일][30일][90일]
export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export class ActorStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(STATS_PERIODS)
  days?: StatsPeriod;

  // 직접 고른 기간(2026-10-13, 태국 날짜 YYYY-MM-DD, 양 끝 포함, 최대 1년) — 주면 days 대신. 범위 검사는 resolveRange
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class AgencyDashboardQueryDto extends ActorStatsQueryDto {
  // 전체 / 1인 아티스트만 / CP방만(2026-10-13 사용자 요청: 통계를 아티스트·CP로 나눠 보기)
  @IsOptional()
  @IsIn(['ALL', 'SOLO', 'COUPLE'])
  kind?: 'ALL' | 'SOLO' | 'COUPLE';

  // 한 소속사만(2026-10-20, 운영자 홈 대시보드) — CP방은 멤버 중 한 명이라도 그 소속사면 포함. 소속사 직원은 원래 자기 소속사만 보여서 의미 없음
  @IsOptional()
  @IsString()
  agencyId?: string;
}

export class AgencyRecordsQueryDto {
  // 한 아티스트만(없으면 볼 수 있는 방 전체) — 참조 ID라 @IsUUID 대신 @IsString
  @IsOptional()
  @IsString()
  actorId?: string;
}
