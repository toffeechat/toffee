import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SmokeService } from './smoke.service.js';
import { SMOKE_IDS } from './smoke-ids.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from '../auth/auth.service.js';

const SECRET = 'a-very-long-smoke-test-secret-for-unit-tests';

const make = (env: Record<string, string>) => {
  const tx = {
    user: { upsert: vi.fn() },
    actor: { upsert: vi.fn() },
    subscription: { upsert: vi.fn() },
    message: { deleteMany: vi.fn() },
  };
  const prisma = { $transaction: vi.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)) };
  const auth = { issueShortAccessToken: vi.fn((user: { id: string }) => Promise.resolve(`token-${user.id}`)) };
  const service = new SmokeService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
  );
  return { service, prisma, tx, auth };
};

describe('배포 후 자동 점검 세션', () => {
  it('SMOKE_TEST_SECRET이 없는 서버에선 404, 데이터를 건드리지 않음', async () => {
    const { service, prisma } = make({});
    await expect(service.session(SECRET)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('비밀값이 틀리거나 없으면 401', async () => {
    const { service, prisma } = make({ SMOKE_TEST_SECRET: SECRET });
    await expect(service.session('wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.session(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('맞으면 점검 계정·숨긴 대화방을 보장하고 두 계정의 짧은 토큰을 줌', async () => {
    const { service, tx, auth } = make({ SMOKE_TEST_SECRET: SECRET });
    const session = await service.session(` ${SECRET} `);
    expect(session).toEqual({ actorId: SMOKE_IDS.actor, fanToken: `token-${SMOKE_IDS.fanUser}`, artistToken: `token-${SMOKE_IDS.artistUser}` });
    expect(tx.user.upsert).toHaveBeenCalledTimes(2);
    // 둘러보기·검색에 안 보이게 활동 종료 상태, 소속사 없음
    const actorArgs = tx.actor.upsert.mock.calls[0][0];
    expect(actorArgs.create.retiredAt).toBeInstanceOf(Date);
    expect(actorArgs.update.agencyId).toBeNull();
    expect(auth.issueShortAccessToken).toHaveBeenCalledWith(expect.objectContaining({ id: SMOKE_IDS.fanUser }), '10m');
  });
});
