import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { DemoService } from './demo.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { DemoAccessService } from './demo-access.service.js';

const make = (env: Record<string, string>, recentlyActive = false, demoDb = true) => {
  // 데모 DB(시드 계정 있음, 오래된 스토어 결제 없음) — demoDb=false면 운영 DB처럼(2026-10-27)
  const prisma = {
    $transaction: vi.fn(),
    user: { count: vi.fn().mockResolvedValue(10), findUnique: vi.fn().mockResolvedValue(demoDb ? { id: 'demo-admin' } : null) },
    purchaseCharge: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const demoAccess = { recentlyActive: vi.fn().mockResolvedValue(recentlyActive) };
  const service = new DemoService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    prisma as unknown as PrismaService,
    demoAccess as unknown as DemoAccessService,
  );
  return { service, prisma };
};

describe('운영자 화면 데모 초기화', () => {
  it('운영 서버나 DEMO_SEED가 없는 서버에선 404, 데이터를 건드리지 않음', async () => {
    const envs: Record<string, string>[] = [{ NODE_ENV: 'production', DEMO_SEED: 'true' }, { NODE_ENV: 'development' }];
    for (const env of envs) {
      const { service, prisma } = make(env);
      expect(service.isEnabled()).toBe(false);
      await expect(service.reset()).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('데모 서버에선 한 트랜잭션으로 초기화', async () => {
    const { service, prisma } = make({ NODE_ENV: 'development', DEMO_SEED: 'true' });
    expect(service.isEnabled()).toBe(true);
    await service.reset();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('DB가 데모 DB가 아니면(시드 계정 없음) 데모 서버 설정이어도 지우지 않음', async () => {
    const { service, prisma } = make({ NODE_ENV: 'development', DEMO_SEED: 'true' }, false, false);
    await expect(service.reset()).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('데모 매일 새벽 자동 초기화', () => {
  const demo = { NODE_ENV: 'development', DEMO_SEED: 'true' };

  it('DEMO_DAILY_RESET=true인 데모 서버에서만', async () => {
    for (const env of [demo, { ...demo, NODE_ENV: 'production', DEMO_DAILY_RESET: 'true' }]) {
      const { service, prisma } = make(env);
      expect(await service.dailyReset()).toBe('off');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
    const { service, prisma } = make({ ...demo, DEMO_DAILY_RESET: 'true' });
    expect(await service.dailyReset()).toBe('reset');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('최근 30분 안에 쓰던 사람이 있으면 그날은 건너뜀', async () => {
    const { service, prisma } = make({ ...demo, DEMO_DAILY_RESET: 'true' }, true);
    expect(await service.dailyReset()).toBe('skipped');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('데모 DB가 아니면 자동 초기화도 거절', async () => {
    const { service, prisma } = make({ ...demo, DEMO_DAILY_RESET: 'true' }, false, false);
    expect(await service.dailyReset()).toBe('blocked');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
