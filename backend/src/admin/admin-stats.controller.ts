import { Controller, Get, Query } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { rangeBounds, resolveRange } from '../actors/agency-stats.service.js';
import { ActorStatsQueryDto } from '../actors/dto/agency-stats-query.dto.js';
import { SubscriptionEventsQueryDto } from './dto/admin-stats-query.dto.js';
import { SubscriptionEventType } from '../generated/prisma/enums.js';

@Roles(Role.ADMIN)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  // 운영자 홈 맨 위 오늘 숫자(대기 신고·오늘 가입·접속 등)
  @Get('summary')
  summary() {
    return this.stats.summary();
  }

  // 신규 가입·신규 구독 금액 추이(2026-10-20) — 기간은 소속사 대시보드와 같음(최근 7·30·90일 또는 from~to, 최대 1년)
  @Get('overview')
  overview(@Query() query: ActorStatsQueryDto) {
    return this.stats.overview(resolveRange(query));
  }

  @Get('breakdown')
  breakdown() {
    return this.stats.breakdown();
  }

  // 운영자 홈 오늘 숫자 → 목록(2026-10-25) — 그 기간 구독 시작·해지 한 건씩(누가 어느 방, 가격)
  @Get('subscription-events')
  subscriptionEvents(@Query() query: SubscriptionEventsQueryDto) {
    return this.stats.subscriptionEvents(rangeBounds(resolveRange(query)), query.type ?? SubscriptionEventType.STARTED);
  }

  // 그 기간 방별 아티스트 메시지·팬 답장 수 — 토피룸 모니터링의 "그날 메시지" 보기
  @Get('message-rooms')
  messageRooms(@Query() query: ActorStatsQueryDto) {
    return this.stats.messageRooms(rangeBounds(resolveRange(query)));
  }
}
