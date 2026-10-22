/**
 * 같은 CP 묶음 갈아타기(2026-10-22 사용자 결정) — 같은 CP방이 든 묶음(A+CP, B+CP, A+B+CP)은 스토어에 한 "구독 그룹"으로 등록해서
 * 팬이 묶음을 바꾸면 구독 하나에서 상품만 바뀌게(두 번 결제 방지). 단계(애플 구독 그룹의 순위): 전체(A+B+CP) = 1단계(위), A+CP·B+CP = 2단계(같은 높이).
 */
export interface GroupActor {
  id: string;
  kind: 'SOLO' | 'COUPLE';
  coupleMembers?: { memberId: string }[];
}

export interface StoreGroup {
  /** 그룹의 기준 CP방 */
  roomId: string;
  /** 1 = 전체(CP 멤버 모두 + CP방), 2 = 일부 */
  level: 1 | 2;
}

/** 묶음이 속한 구독 그룹 — CP방이 정확히 하나 든 묶음만(CP방이 없거나 둘 이상이면 그룹 없음 = 갈아타기 대상 아님) */
export function storeGroupOf(actors: GroupActor[]): StoreGroup | null {
  const couples = actors.filter((actor) => actor.kind === 'COUPLE');
  if (couples.length !== 1) return null;
  const ids = new Set(actors.map((actor) => actor.id));
  const members = couples[0].coupleMembers ?? [];
  const full = members.length > 0 && members.every((member) => ids.has(member.memberId));
  return { roomId: couples[0].id, level: full ? 1 : 2 };
}

export type SwitchTiming = 'now' | 'next-renewal';

/**
 * 바뀌는 시점 — 애플은 아래 단계로 내릴 때만 다음 갱신 때(애플 규칙), 올리기·같은 단계는 바로. 구글은 앱이 "남은 기간을 새 묶음 날수로 환산"
 * (with-time-proration)으로 바꿔서 늘 바로. 테스트 구독(스토어 없음)도 바로.
 */
export function switchTiming(from: StoreGroup, to: StoreGroup, platform: 'IOS' | 'ANDROID' | null): SwitchTiming {
  return platform === 'IOS' && to.level > from.level ? 'next-renewal' : 'now';
}
