// 배포 후 자동 점검(스모크 테스트, 2026-10-25) 전용 계정·대화방 — 고정 ID라 몇 번을 돌려도 같은 것을 다시 씀.
// 데모 고정 ID(00000000-0000-4000-8000-…)와 안 겹치게 9000대. 데모 초기화가 지워도 다음 점검 때 다시 만들어짐
const smokeId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
export const SMOKE_IDS = {
  actor: smokeId(1),
  artistUser: smokeId(2),
  fanUser: smokeId(3),
} as const;
