import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

// 소속사 대시보드·아티스트별 통계의 기간(일) — 앱의 [7일][30일][90일]
export const STATS_PERIODS = [7, 30, 90] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export class ActorStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(STATS_PERIODS)
  days?: StatsPeriod;
}

export class AgencyDashboardQueryDto extends ActorStatsQueryDto {
  // 전체 / 1인 아티스트만 / CP방만(2026-10-13 사용자 요청: 통계를 아티스트·CP로 나눠 보기)
  @IsOptional()
  @IsIn(['ALL', 'SOLO', 'COUPLE'])
  kind?: 'ALL' | 'SOLO' | 'COUPLE';
}

export class AgencyRecordsQueryDto {
  // 한 아티스트만(없으면 볼 수 있는 방 전체) — 참조 ID라 @IsUUID 대신 @IsString
  @IsOptional()
  @IsString()
  actorId?: string;
}
