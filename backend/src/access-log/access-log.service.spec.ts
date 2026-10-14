import { describe, expect, it, vi } from 'vitest';
import { AccessLogService } from './access-log.service.js';
import { clientInfoFromRequest, describeUserAgent, type ClientInfo } from './client-info.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { Request } from 'express';

const CLIENT: ClientInfo = { platform: 'ios', deviceModel: 'iPhone 15', osVersion: 'iOS 18.1', appVersion: '1.0.0', userAgent: null, ip: '1.2.3.4' };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('접속 기록', () => {
  it('로그인하면 LOGIN 한 줄 + 마지막 접속 갱신', async () => {
    const create = vi.fn().mockReturnValue('create');
    const update = vi.fn().mockReturnValue('update');
    const $transaction = vi.fn().mockResolvedValue([]);
    const service = new AccessLogService({ accessLog: { create }, user: { update }, $transaction } as unknown as PrismaService);
    await service.recordLogin('u1', 'KAKAO', CLIENT);
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', kind: 'LOGIN', method: 'KAKAO', deviceModel: 'iPhone 15', ip: '1.2.3.4' });
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: 'u1' } });
  });

  it('기록이 실패해도 로그인은 계속(예외를 던지지 않음)', async () => {
    const service = new AccessLogService({
      accessLog: { create: vi.fn() },
      user: { update: vi.fn() },
      $transaction: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService);
    await expect(service.recordLogin('u1', 'GOOGLE', CLIENT)).resolves.toBeUndefined();
  });

  it('마지막 접속이 한 시간 안이면 아무것도 안 씀', async () => {
    const updateMany = vi.fn();
    const service = new AccessLogService({ user: { updateMany } } as unknown as PrismaService);
    service.touchVisit('u1', new Date(Date.now() - 10 * 60 * 1000), CLIENT);
    await flush();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('한 시간이 지났으면 VISIT 한 줄 — 동시에 온 다른 요청이 먼저 갱신했으면(count 0) 안 남김', async () => {
    const create = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const service = new AccessLogService({ user: { updateMany }, accessLog: { create } } as unknown as PrismaService);
    service.touchVisit('u1', null, CLIENT);
    service.touchVisit('u1', null, CLIENT);
    await flush();
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', kind: 'VISIT', platform: 'ios' });
  });
});

describe('기기 정보', () => {
  const req = (headers: Record<string, string>, ip = '9.9.9.9') => ({ headers, ip }) as unknown as Request;

  it('앱이 보낸 헤더를 그대로(길이만 자름)', () => {
    const info = clientInfoFromRequest(req({ 'x-client-platform': 'android', 'x-client-device': 'SM-S918N', 'x-client-os': 'Android 14', 'x-client-version': '1.0.3' }));
    expect(info).toMatchObject({ platform: 'android', deviceModel: 'SM-S918N', osVersion: 'Android 14', appVersion: '1.0.3', ip: '9.9.9.9' });
    expect(clientInfoFromRequest(req({ 'x-client-device': 'x'.repeat(500) })).deviceModel).toHaveLength(60);
  });

  it('웹은 기기 이름 대신 브라우저·OS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
    expect(clientInfoFromRequest(req({ 'user-agent': ua, 'x-client-platform': 'web' })).deviceModel).toBe('Chrome · macOS');
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
    expect(describeUserAgent('okhttp/4.12.0')).toBeNull();
  });
});
