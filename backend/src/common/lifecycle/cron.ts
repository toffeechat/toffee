import { Cron as ScheduleCron, type CronOptions } from '@nestjs/schedule';

export { CronExpression } from '@nestjs/schedule';

/**
 * `@nestjs/schedule`의 `@Cron` + `waitForCompletion`(2026-10-25) — 이 옵션이 있어야 ① 앞 실행이 안 끝났으면 다음 실행을 건너뛰고
 * (1분마다 도는 일이 겹쳐 같은 알림을 두 번 보내지 않게) ② 배포 때 ShutdownService가 "지금 도는 cron"을 알 수 있어서 끝날 때까지
 * 기다렸다가 DB를 끊음. cron은 꼭 여기서 가져올 것(`lifecycle.spec.ts`가 `@nestjs/schedule`에서 바로 가져오면 실패시킴).
 */
export function Cron(cronTime: string | Date, options: CronOptions = {}): MethodDecorator {
  return ScheduleCron(cronTime, { waitForCompletion: true, ...options });
}
