import { Injectable, Logger } from '@nestjs/common';
import { captureException } from '@sentry/nestjs';
import { Cron, CronExpression } from '../common/lifecycle/cron.js';
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
      // 잡아서 넘기는 실패는 Sentry가 모름 — 직접 보냄(2026-11-24 점검 5차, 운영자 홈 "최근 오류"·폰 알림에 보이게)
      captureException(error, { tags: { job: 'retire-due' } });
    }
  }

  // 계약 종료 31일 전 알림(2026-10-20) — 하루 한 번, 태국 오전 10시
  @Cron('0 3 * * *')
  async contracts() {
    try {
      const count = await this.actors.alertContractsEnding();
      if (count > 0) this.logger.log(`계약 종료 임박 알림 ${count}건`);
    } catch (error) {
      this.logger.error('계약 종료 알림 실패', error as Error);
      // 잡아서 넘기는 실패는 Sentry가 모름 — 직접 보냄(2026-11-24 점검 5차, 운영자 홈 "최근 오류"·폰 알림에 보이게)
      captureException(error, { tags: { job: 'contract-ending' } });
    }
  }
}
