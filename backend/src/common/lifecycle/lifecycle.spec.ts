import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';
import { ShutdownService } from './shutdown.service.js';

function service(jobs: Record<string, Partial<CronJob>> = {}) {
  const map = new Map(Object.entries(jobs) as [string, CronJob][]);
  return new ShutdownService({ getCronJobs: () => map } as unknown as SchedulerRegistry);
}

// 배포 때(SIGTERM) 하던 일을 끝내고 끄기(2026-10-25)
describe('ShutdownService', () => {
  it('처리 중인 요청이 끝날 때까지 기다림 — 끝 함수를 두 번 불러도 한 번만 셈', async () => {
    const shutdown = service();
    const done = shutdown.requestStarted();
    const drained = shutdown.drain(2_000, 5);
    expect(shutdown.isDraining).toBe(true);
    setTimeout(() => {
      done();
      done();
    }, 20);
    await expect(drained).resolves.toBe(true);
    expect(shutdown.pending().requests).toBe(0);
  });

  it('기다리지 않고 보낸 일(푸시 등)도 끝날 때까지 기다림, 실패해도 빠짐', async () => {
    const shutdown = service();
    let fail!: (error: Error) => void;
    const work = shutdown.track(new Promise<void>((_, reject) => (fail = reject)));
    work.catch(() => {});
    expect(shutdown.pending().tasks).toBe(1);
    setTimeout(() => fail(new Error('fcm down')), 20);
    await expect(shutdown.drain(2_000, 5)).resolves.toBe(true);
  });

  it('끄기 시작하면 cron을 멈추고, 지금 도는 cron이 끝날 때까지 기다림', async () => {
    const running = { isCallbackRunning: true, stop: vi.fn() };
    const idle = { isCallbackRunning: false, stop: vi.fn() };
    const shutdown = service({ release: running, cleanup: idle });
    const drained = shutdown.drain(2_000, 5);
    expect(running.stop).toHaveBeenCalled();
    expect(idle.stop).toHaveBeenCalled();
    expect(shutdown.pending().crons).toEqual(['release']);
    setTimeout(() => (running.isCallbackRunning = false), 20);
    await expect(drained).resolves.toBe(true);
  });

  it('시간이 넘으면 false(그래도 끔)', async () => {
    const shutdown = service();
    shutdown.requestStarted();
    await expect(shutdown.drain(30, 5)).resolves.toBe(false);
  });
});

// cron은 common/lifecycle/cron.ts(waitForCompletion 기본)에서만 — 직접 가져오면 배포 때 도는 중인지 몰라서 중간에 끊김
describe('cron 가져오는 곳', () => {
  it('src 안에서 @nestjs/schedule의 Cron을 바로 쓰지 않음', () => {
    const root = join(import.meta.dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'generated' || name === 'node_modules') continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.ts') && !path.includes(join('common', 'lifecycle'))) {
          const source = readFileSync(path, 'utf8');
          if (/import\s*\{[^}]*\bCron\b[^}]*\}\s*from\s*'@nestjs\/schedule'/.test(source)) offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
