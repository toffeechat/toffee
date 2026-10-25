import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

/**
 * 배포·재시작(SIGTERM) 때 하던 일을 끝내고 끄기(2026-10-25). Nest 기본 종료(`enableShutdownHooks`)는 onModuleDestroy(= DB 연결
 * 끊기)를 HTTP 서버를 닫기 **전에** 불러서, 처리 중이던 요청·기다리지 않고 보낸 푸시·돌던 cron이 DB를 잃고 중간에 실패했음
 * (메시지는 저장됐는데 응답이 안 가거나, 공개 알림을 "보냄"으로 표시한 뒤 푸시를 못 보냄). 그래서 main.ts가 신호를 직접 받아
 * ① 새 cron 실행 멈춤·실시간 연결 닫기 ② 처리 중인 요청·백그라운드 작업·돌던 cron이 끝나길 기다림(최대 SHUTDOWN_GRACE_MS)
 * ③ 그다음에 app.close()(DB 연결 끊기) 순서로 끔.
 */
@Injectable()
export class ShutdownService {
  private readonly logger = new Logger(ShutdownService.name);
  private draining = false;
  private requests = 0;
  private readonly tasks = new Set<Promise<unknown>>();

  constructor(private readonly scheduler: SchedulerRegistry) {}

  /** 끄는 중 — 헬스체크(ready)는 503, 새 실시간 연결은 거절(다른 서버로 붙게) */
  get isDraining(): boolean {
    return this.draining;
  }

  /** 요청 하나 시작 — 끝나면(응답 완료·끊김) 돌려받은 함수를 부름. 여러 번 불러도 한 번만 셈 */
  requestStarted(): () => void {
    this.requests += 1;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.requests -= 1;
    };
  }

  /**
   * 응답과 상관없이 뒤에서 도는 일(푸시 발송 등) — 끄기 전에 끝나길 기다림. 결과·오류는 그대로 돌려줌(호출한 쪽이 처리)
   */
  track<T>(work: Promise<T>): Promise<T> {
    this.tasks.add(work);
    const remove = () => this.tasks.delete(work);
    work.then(remove, remove);
    return work;
  }

  /** 지금 끝나길 기다려야 하는 일 */
  pending(): { requests: number; tasks: number; crons: string[] } {
    const crons = [...this.scheduler.getCronJobs()].filter(([, job]) => job.isCallbackRunning).map(([name]) => name);
    return { requests: this.requests, tasks: this.tasks.size, crons };
  }

  /** 끄기 시작 — 새 cron 실행을 멈춤(이미 도는 건 끝까지). 두 번째부터는 아무것도 안 함 */
  beginDrain(): void {
    if (this.draining) return;
    this.draining = true;
    for (const job of this.scheduler.getCronJobs().values()) void job.stop();
  }

  /**
   * 처리 중인 일이 다 끝나길 기다림 — 다 끝나면 true, 시간이 넘으면 남은 걸 로그로 남기고 false(그래도 끔)
   */
  async drain(timeoutMs: number, pollMs = 100): Promise<boolean> {
    this.beginDrain();
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const left = this.pending();
      if (left.requests === 0 && left.tasks === 0 && left.crons.length === 0) return true;
      if (Date.now() >= deadline) {
        this.logger.warn(`종료 대기 시간 초과 — 요청 ${left.requests}개, 백그라운드 ${left.tasks}개, cron [${left.crons.join(', ')}] 남음`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

@Global()
@Module({
  providers: [ShutdownService],
  exports: [ShutdownService],
})
export class LifecycleModule {}
