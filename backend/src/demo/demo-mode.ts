import type { Prisma } from '../generated/prisma/client.js';

// 시드의 고정 운영자 계정 ID(demo-seed.ts DEMO_IDS.admin과 같은 값 — demo-seed를 import하면 무거워서 값만 둠, demo-mode.spec이 같은지 확인)
export const DEMO_ADMIN_ID = '00000000-0000-4000-8000-000000000103';

// DEMO_SEED 값 해석(2026-10-01) — 컨테이너 시작 때 데이터 넣기(seed-cli)와 운영자 화면 초기화(DemoService)가 같이 씀
export type SeedDecision = 'skip-production' | 'skip-unknown' | 'seed-if-empty' | 'reset';

export function decideSeed(mode: string | undefined, nodeEnv: string | undefined): SeedDecision {
  if (nodeEnv === 'production') return 'skip-production';
  if (mode === 'true') return 'seed-if-empty';
  if (mode === 'reset') return 'reset';
  return 'skip-unknown';
}

/** 데모 서버인지(데모 초기화 버튼을 켤지) — production이 아니고 DEMO_SEED가 true/reset일 때 */
export const isDemoServer = (mode: string | undefined, nodeEnv: string | undefined) => {
  const decision = decideSeed(mode, nodeEnv);
  return decision === 'seed-if-empty' || decision === 'reset';
};

/**
 * 데이터를 전부 지우기 직전 DB 확인(2026-10-27) — NODE_ENV만으로 막으면 운영 서버에 NODE_ENV를 잘못 넣거나 DEMO_SEED를 실수로 남겼을 때
 * 실제 회원·결제가 통째로 지워짐. 그래서 "이 DB가 데모 DB다"를 DB 내용으로 한 번 더 확인함(Railway 변수 추가 없이):
 * - 회원이 있는데 시드의 고정 운영자 계정(DEMO_IDS.admin)이 없으면 거절 — 운영 DB엔 이 고정 ID가 생길 일이 없음. 빈 DB는 통과(첫 시드)
 * - 일주일보다 오래된 애플·구글 결제 기록이 있으면 거절 — 데모는 매일(또는 수시로) 초기화돼서 스토어 결제(샌드박스)가 있어도 금방 지워짐.
 *   오래된 스토어 결제가 남아 있다는 건 실제로 운영되는 DB라는 뜻. 데모 시드의 가짜 구매는 결제 기록이 없거나 SANDBOX라 해당 없음
 * 지워도 되면 null, 아니면 이유(로그용)
 */
export const STORE_CHARGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function demoWipeBlocker(prisma: Pick<Prisma.TransactionClient, 'user' | 'purchaseCharge'>, now = Date.now()): Promise<string | null> {
  const [users, marker, storeCharge] = await Promise.all([
    prisma.user.count(),
    prisma.user.findUnique({ where: { id: DEMO_ADMIN_ID }, select: { id: true } }),
    prisma.purchaseCharge.findFirst({
      where: { source: { in: ['APPLE', 'GOOGLE'] }, chargedAt: { lt: new Date(now - STORE_CHARGE_MAX_AGE_MS) } },
      select: { id: true },
    }),
  ]);
  if (users > 0 && !marker) return '데모 시드 계정이 없는 DB(운영 DB일 수 있음)';
  if (storeCharge) return '일주일보다 오래된 애플·구글 결제 기록이 있는 DB(실제 결제가 있는 DB일 수 있음)';
  return null;
}
