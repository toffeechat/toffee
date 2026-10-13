import { describe, expect, it } from 'vitest';
import { changePercent, rankRows, repliesPerMessage, type RankableRow } from './dashboard-rank';

const NOW = new Date('2026-10-13T12:00:00Z').getTime();
const row = (id: string, extra: Partial<RankableRow> = {}): RankableRow => ({
  id,
  retiredAt: null,
  lastBroadcastAt: '2026-10-12T12:00:00Z',
  subscriberCount: 0,
  newSubscriptions: 0,
  cancellations: 0,
  messagesSent: 0,
  fanReplies: 0,
  ...extra,
});

describe('소속사 대시보드 순위', () => {
  it('구독자 많은 순, 같으면 그대로 구독자 기준', () => {
    const rows = [row('a', { subscriberCount: 3 }), row('b', { subscriberCount: 9 }), row('c', { subscriberCount: 5 })];
    expect(rankRows(rows, 'subscribers', NOW).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('오래 안 보낸 순 — 한 번도 안 보낸 방이 맨 위, 활동 종료는 뺌', () => {
    const rows = [
      row('recent'),
      row('never', { lastBroadcastAt: null }),
      row('old', { lastBroadcastAt: '2026-10-01T12:00:00Z' }),
      row('retired', { lastBroadcastAt: null, retiredAt: '2026-09-01T00:00:00Z' }),
    ];
    expect(rankRows(rows, 'idle', NOW).map((r) => r.id)).toEqual(['never', 'old', 'recent']);
  });

  it('해지 순은 해지가 있는 방만, 반응 순은 메시지를 보낸 방만', () => {
    const rows = [
      row('a', { cancellations: 2, messagesSent: 4, fanReplies: 10 }),
      row('b', { messagesSent: 2, fanReplies: 10 }),
      row('c', { fanReplies: 30 }),
    ];
    expect(rankRows(rows, 'cancellations', NOW).map((r) => r.id)).toEqual(['a']);
    expect(rankRows(rows, 'engagement', NOW).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('메시지당 답장·증감률', () => {
    expect(repliesPerMessage({ messagesSent: 3, fanReplies: 10 })).toBe(3.3);
    expect(repliesPerMessage({ messagesSent: 0, fanReplies: 10 })).toBeNull();
    expect(changePercent(15, 10)).toBe(50);
    expect(changePercent(5, 10)).toBe(-50);
    expect(changePercent(5, 0)).toBeNull();
  });
});
