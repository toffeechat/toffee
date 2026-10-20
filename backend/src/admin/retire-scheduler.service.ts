import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminActorsService } from './admin-actors.service.js';

/** 활동 종료 예정 시각이 지난 아티스트를 1분마다 실제로 종료(2026-10-20) — 알림·환불 규칙은 바로 종료와 같음 */
@Injectable()
export class RetireScheduler {
  private readonly logger = new Logger(RetireScheduler.name);

  constructor(private readonly actors: AdminActorsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run() {
    try {
      const count = await this.actors.retireDue();
      if (count > 0) this.logger.log(`예정된 활동 종료 ${count}건 처리`);
    } catch (error) {
      this.logger.error('활동 종료 예정 처리 실패', error as Error);
    }
  }
}
