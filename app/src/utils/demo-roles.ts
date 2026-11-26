/**
 * 데모 로그인 역할 → 시드 고정 계정(서버 `demo-seed.ts`). 화면·플랫폼과 상관없는 부분만 모아 둠(테스트하려고) — 쓰는 곳은 `@/lib/demo-entry`.
 *
 * - 버튼으로 보이는 역할: 소속사·아티스트·팬(+ 운영자는 `?as=admin` 주소로 들어왔거나 개발 빌드일 때만).
 * - 주소로만 들어가는 역할(2026-11-26 사용자 요청): `as=fan2`(팬 2 — CP 전체 묶음 + 누가 개인 구독),
 *   `as=former`(이전 소속사 — 누가가 이적해 나간 곳). 데모 로그인 칸이 복잡해지지 않게 버튼은 늘리지 않고,
 *   그 주소로 들어왔을 때(또는 지난번에 그 역할로 들어왔을 때)만 그 버튼이 보임.
 */
export type DemoRole = 'agency' | 'artist' | 'fan' | 'admin' | 'fan2' | 'former';

/** 데모 로그인 칸 기본 버튼 순서(운영자는 숨김 조건이 따로) */
export const DEMO_ROLES: DemoRole[] = ['agency', 'artist', 'fan', 'admin'];

/** 주소(`?as=`)로만 들어가는 역할 — 버튼은 그 역할로 들어왔을 때만 */
export const LINK_ONLY_DEMO_ROLES: DemoRole[] = ['fan2', 'former'];

export const DEMO_ROLE_EMAILS: Record<DemoRole, string> = {
  agency: 'staff@toffee.demo',
  artist: 'caramel-self@toffee.demo',
  fan: 'fan1@toffee.demo',
  admin: 'admin@toffee.demo',
  fan2: 'fan2@toffee.demo',
  former: 'former-staff@toffee.demo',
};

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return !!value && Object.prototype.hasOwnProperty.call(DEMO_ROLE_EMAILS, value);
}

export function isLinkOnlyDemoRole(value: DemoRole | null | undefined): boolean {
  return !!value && LINK_ONLY_DEMO_ROLES.includes(value);
}

/** 로그인 칸에 보일 역할 버튼 — 기본 + (운영자: 보일 때만) + (주소 전용 역할: 지금 고른 것만) */
export function visibleDemoRoles(options: { showAdmin: boolean; extra: DemoRole | null }): DemoRole[] {
  const roles = DEMO_ROLES.filter((role) => role !== 'admin' || options.showAdmin);
  if (options.extra && isLinkOnlyDemoRole(options.extra)) roles.push(options.extra);
  return roles;
}
