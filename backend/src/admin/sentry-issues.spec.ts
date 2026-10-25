import { describe, expect, it, vi } from 'vitest';
import { alertCandidates, toErrorIssue } from './sentry-issues.js';
import { SentryIssuesService } from './sentry-issues.service.js';

const NOW = new Date('2026-10-25T10:20:00Z');
const hour = (iso: string) => Date.parse(iso) / 1000;

const raw = (over: Record<string, unknown> = {}) => ({
  id: '101',
  shortId: 'TOFFEE-BACKEND-1',
  title: 'TypeError: x is undefined',
  culprit: 'MessagesService.send',
  permalink: 'https://toffeechat.sentry.io/issues/101/',
  count: '57',
  userCount: 4,
  firstSeen: '2026-10-20T00:00:00Z',
  lastSeen: '2026-10-25T10:15:00Z',
  stats: { '24h': [[hour('2026-10-25T09:00:00Z'), 12], [hour('2026-10-25T10:00:00Z'), 5]] as [number, number][] },
  ...over,
});

const config = (env: Record<string, string>) => ({ get: (key: string) => env[key] });

describe('Sentry 최근 오류(2026-10-25)', () => {
  it('API 응답을 화면용으로 — 누적 횟수는 숫자로, 24시간 횟수는 시간 묶음 합', () => {
    const issue = toErrorIssue(raw(), 'toffee-backend');
    expect(issue).toMatchObject({ id: '101', count: 57, count24h: 17, userCount: 4, project: 'toffee-backend', url: 'https://toffeechat.sentry.io/issues/101/' });
  });

  it('새 오류는 처음 발생이 30분 안, 많이 남은 최근 두 시간 묶음 중 기준 이상', () => {
    const fresh = toErrorIssue(raw({ id: '1', firstSeen: '2026-10-25T10:00:00Z' }), 'p');
    const old = toErrorIssue(raw({ id: '2' }), 'p');
    expect(alertCandidates([fresh, old], NOW, 0).map((c) => [c.issue.id, c.kind])).toEqual([['1', 'NEW']]);
    const spikes = alertCandidates([old], NOW, 10);
    expect(spikes).toEqual([expect.objectContaining({ kind: 'SPIKE', bucket: String(hour('2026-10-25T09:00:00Z')), hourCount: 12 })]);
  });

  it('토큰이 없으면 "연결 전", Sentry를 부르지 않음', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const service = new SentryIssuesService(config({}) as never, {} as never, { notify: vi.fn() } as never);
    expect(await service.view()).toEqual({ status: 'NOT_CONNECTED', missing: ['SENTRY_API_TOKEN'] });
    await service.watch(NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('프로젝트마다 가져와 5분 캐시, 알림은 기록을 먼저 남긴 것만(같은 알림 두 번 없음)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify([raw({ firstSeen: '2026-10-25T10:10:00Z' })]), { status: 200 }));
    const seen = new Set<string>();
    const prisma = {
      errorAlertSent: {
        create: vi.fn(({ data }: { data: { issueId: string; kind: string; bucket: string } }) => {
          const key = `${data.issueId}:${data.kind}:${data.bucket}`;
          if (seen.has(key)) return Promise.reject(Object.assign(new Error('dup'), { code: 'P2002' }));
          seen.add(key);
          return Promise.resolve({});
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    const service = new SentryIssuesService(config({ SENTRY_API_TOKEN: 't', SENTRY_PROJECTS: 'toffee-backend', ERROR_ALERT_HOURLY_THRESHOLD: '10' }) as never, prisma as never, alerts as never);

    const view = await service.view();
    await service.view();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/0/projects/toffeechat/toffee-backend/issues/?query=is%3Aunresolved&statsPeriod=24h');
    expect(view).toMatchObject({ status: 'OK', total24h: 17, issues: [expect.objectContaining({ id: '101' })] });
    expect((view as { issues: object[] }).issues[0]).not.toHaveProperty('hourly');

    await service.watch(NOW);
    await service.watch(NOW);
    // 새 오류 1 + 09시 묶음 12번(기준 10) 1 — 두 번째 확인에선 더 안 감
    expect(alerts.notify).toHaveBeenCalledTimes(2);
    expect(alerts.notify.mock.calls.map((call) => call[0])).toEqual(['ERROR', 'ERROR']);
    expect(alerts.notify.mock.calls[0][1]).toContain('새 오류');
    expect(alerts.notify.mock.calls[1][1]).toContain('1시간에 12번');
    fetchMock.mockRestore();
  });

  it('Sentry가 실패하면 FAILED + 바로 앞 결과', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 401 }));
    const service = new SentryIssuesService(config({ SENTRY_API_TOKEN: 't' }) as never, {} as never, { notify: vi.fn() } as never);
    expect(await service.view()).toMatchObject({ status: 'FAILED', issues: [], fetchedAt: null, error: expect.stringContaining('401') });
    fetchMock.mockRestore();
  });
});
