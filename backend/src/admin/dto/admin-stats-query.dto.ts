import { IsIn, IsOptional } from 'class-validator';
import { ActorStatsQueryDto } from '../../actors/dto/agency-stats-query.dto.js';
import { SubscriptionEventType } from '../../generated/prisma/enums.js';

// 그 기간 구독 시작·해지 목록(2026-10-25, 운영자 홈 "오늘 구독 시작" 카드) — 기본은 시작
export class SubscriptionEventsQueryDto extends ActorStatsQueryDto {
  @IsOptional()
  @IsIn(Object.values(SubscriptionEventType))
  type?: SubscriptionEventType;
}
