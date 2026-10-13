import { idleDays } from '@/utils/idle-days';

/** 소속사 대시보드 순위 기준(2026-10-13 개편) — 대시보드 카드(상위 5)와 "전체 순위" 화면이 같은 정렬을 씀 */
export const RANK_METRICS = ['subscribers', 'idle', 'newSubs', 'replies', 'cancellations', 'engagement'] as const;
export type RankMetric = (typeof RANK_METRICS)[number];

export interface RankableRow {
  id: string;
  retiredAt: string | null;
  lastBroadcastAt: string | null;
  subscriberCount: number;
  newSubscriptions: number;
  cancellations: number;
  messagesSent: number;
  fanReplies: number;
}

export function isRankMetric(value: unknown): value is RankMetric {
  return typeof value === 'string' && (RANK_METRICS as readonly string[]).includes(value);
}

/** 메시지 하나에 팬 답장이 평균 몇 개 왔는지(소수 첫째 자리). 메시지가 없으면 null */
export function repliesPerMessage(row: { messagesSent: number; fanReplies: number }): number | null {
  return row.messagesSent > 0 ? Math.round((row.fanReplies / row.messagesSent) * 10) / 10 : null;
}

/** 순위에 쓰는 값 — 클수록 위. 오래 안 보낸 순은 한 번도 안 보낸 방이 맨 위 */
export function rankValue(row: RankableRow, metric: RankMetric, now = Date.now()): number {
  switch (metric) {
    case 'subscribers':
      return row.subscriberCount;
    case 'idle':
      return idleDays(row.lastBroadcastAt, now) ?? Number.MAX_SAFE_INTEGER;
    case 'newSubs':
      return row.newSubscriptions;
    case 'replies':
      return row.fanReplies;
    case 'cancellations':
      return row.cancellations;
    case 'engagement':
      return repliesPerMessage(row) ?? 0;
  }
}

/**
 * 기준에 맞게 거른 뒤 정렬 — 오래 안 보낸 순은 활동 종료한 방을 빼고, 해지 순은 해지가 있는 방만, 반응 순은 메시지를 보낸 방만
 * (0인 방이 줄 세워지면 순위가 의미 없어서). 같으면 구독자 많은 순.
 */
export function rankRows<T extends RankableRow>(rows: T[], metric: RankMetric, now = Date.now()): T[] {
  const eligible = rows.filter((row) => {
    if (metric === 'idle') return !row.retiredAt;
    if (metric === 'cancellations') return row.cancellations > 0;
    if (metric === 'engagement') return row.messagesSent > 0;
    return true;
  });
  return eligible.sort((a, b) => rankValue(b, metric, now) - rankValue(a, metric, now) || b.subscriberCount - a.subscriberCount);
}

/** 앞 기간 대비 증감률(%) — 앞 기간이 0이면 null(“새로”로 표시) */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
