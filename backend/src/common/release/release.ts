import type { Prisma } from '../../generated/prisma/client.js';

// 공개 예정·예약 오픈(2026-10-19) — Actor·Bundle의 releaseAt이 null이거나 지났으면 공개. 열리는 건 이 시각 비교라 정각에 바로
// (푸시만 ReleaseService가 1분마다 보냄). 공개 전엔 팬 화면에 "곧 공개" 카드 + 알림 받기만, 구독은 서버에서 막음.

export function isReleased(releaseAt: Date | null | undefined, now = new Date()): boolean {
  return !releaseAt || releaseAt.getTime() <= now.getTime();
}

/** 이미 공개된 방만(미발송 알림처럼 공개 전 방엔 안 맞는 일에) */
export function releasedActorWhere(now = new Date()): Prisma.ActorWhereInput {
  return { OR: [{ releaseAt: null }, { releaseAt: { lte: now } }] };
}

/** 묶음이 실제로 열리는 시각 — 묶음 자체와 든 방들의 공개 시각 중 가장 늦은 것(모두 없으면 null = 바로) */
export function bundleOpensAt(bundleReleaseAt: Date | null, actorReleaseAts: (Date | null)[]): Date | null {
  const dates = [bundleReleaseAt, ...actorReleaseAts].filter((date): date is Date => !!date);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
