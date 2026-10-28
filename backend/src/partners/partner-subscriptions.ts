/**
 * 검볼 선예매 판정용 구독 요약(2026-10-28) — 아티스트(개인방 id) 하나에 대해 그 아티스트의 개인방과 그 아티스트가 든 커플방을 함께 봄.
 * - active: 그중 하나라도 지금 열려 있음(방 이용권 Subscription.cancelledAt = null)
 * - continuousMonths: 열려 있는 방 중 가장 오래 이어진 방의 "꽉 찬 개월 수"(시작일 + N개월 ≤ 지금). 재구독하면 startedAt이 새로 잡혀 0부터
 * - roomIds: 열려 있는 방 id들(검볼의 "특정 방 구독" 조건)
 * - since: 열려 있는 방 중 가장 이른 시작 시각(검볼의 "기준일 시점 구독" 조건)
 */
export interface RoomAccess {
  actorId: string;
  startedAt: Date;
}

export interface SubscriptionSummary {
  active: boolean;
  continuousMonths: number;
  roomIds: string[];
  since: string | null;
}

export function fullMonthsBetween(from: Date, to: Date): number {
  if (to < from) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const anniversary = new Date(from);
  anniversary.setUTCMonth(from.getUTCMonth() + months);
  // 달마다 날 수가 달라서(1/31 → 2/28) 기념일이 다음 달로 넘어가면 한 달 덜 찬 것으로
  if (anniversary > to || anniversary.getUTCMonth() !== (from.getUTCMonth() + months) % 12) months -= 1;
  return Math.max(0, months);
}

export function summarize(open: RoomAccess[], now: Date): SubscriptionSummary {
  if (!open.length) return { active: false, continuousMonths: 0, roomIds: [], since: null };
  const earliest = open.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b));
  return {
    active: true,
    continuousMonths: fullMonthsBetween(earliest.startedAt, now),
    roomIds: [...new Set(open.map((r) => r.actorId))],
    since: earliest.startedAt.toISOString(),
  };
}
