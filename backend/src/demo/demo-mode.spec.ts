import { describe, expect, it, vi } from 'vitest';
import { DEMO_ADMIN_ID, STORE_CHARGE_MAX_AGE_MS, decideSeed, demoWipeBlocker, isDemoServer } from './demo-mode.js';
import { DEMO_IDS } from './demo-seed.js';

describe('데모 데이터 넣기 판단', () => {
  it('운영에선 어떤 값이어도 실행하지 않음', () => {
    expect(decideSeed('reset', 'production')).toBe('skip-production');
    expect(decideSeed('true', 'production')).toBe('skip-production');
  });

  it('true는 빈 DB일 때만, reset은 항상, 그 밖의 값은 건너뜀', () => {
    expect(decideSeed('true', 'development')).toBe('seed-if-empty');
    expect(decideSeed('reset', 'development')).toBe('reset');
    expect(decideSeed('yes', 'development')).toBe('skip-unknown');
  });

  it('데모 초기화 버튼은 데모 서버에서만', () => {
    expect(isDemoServer('true', 'development')).toBe(true);
    expect(isDemoServer('reset', 'development')).toBe(true);
    expect(isDemoServer(undefined, 'development')).toBe(false);
    expect(isDemoServer('true', 'production')).toBe(false);
  });
});

describe('데모 초기화 전 DB 확인(2026-10-27)', () => {
  const make = (users: number, marker: boolean, oldStoreCharge: boolean) => {
    const findFirst = vi.fn().mockResolvedValue(oldStoreCharge ? { id: 'c1' } : null);
    return {
      prisma: {
        user: { count: vi.fn().mockResolvedValue(users), findUnique: vi.fn().mockResolvedValue(marker ? { id: DEMO_ADMIN_ID } : null) },
        purchaseCharge: { findFirst },
      } as unknown as Parameters<typeof demoWipeBlocker>[0],
      findFirst,
    };
  };

  it('고정 운영자 ID가 시드와 같음', () => {
    expect(DEMO_ADMIN_ID).toBe(DEMO_IDS.admin);
  });

  it('시드된 데모 DB·빈 DB는 지워도 됨', async () => {
    expect(await demoWipeBlocker(make(20, true, false).prisma)).toBeNull();
    expect(await demoWipeBlocker(make(0, false, false).prisma)).toBeNull();
  });

  it('회원은 있는데 시드 계정이 없으면(운영 DB) 거절', async () => {
    expect(await demoWipeBlocker(make(5000, false, false).prisma)).not.toBeNull();
  });

  it('일주일 넘은 애플·구글 결제가 있으면 거절(최근 샌드박스 결제는 괜찮음)', async () => {
    const now = Date.parse('2026-10-27T00:00:00Z');
    const { prisma, findFirst } = make(20, true, true);
    expect(await demoWipeBlocker(prisma, now)).not.toBeNull();
    expect(findFirst.mock.calls[0][0].where).toEqual({ source: { in: ['APPLE', 'GOOGLE'] }, chargedAt: { lt: new Date(now - STORE_CHARGE_MAX_AGE_MS) } });
  });
});
