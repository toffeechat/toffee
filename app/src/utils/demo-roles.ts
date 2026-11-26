/**
 * 데모 로그인 역할 → 시드 고정 계정(서버 `demo-seed.ts`). 화면·플랫폼과 상관없는 부분만 모아 둠(테스트하려고) — 쓰는 곳은 `@/lib/demo-entry`.
 *
 * 버튼(2026-11-26 사용자 결정 — 다 보이게): [소속사][아티스트][팬 1][팬 2][이전 소속사] + 운영자(`?as=admin` 주소로 들어왔거나 개발 빌드일 때만).
 * 주소 `as=`: agency·artist·fan(=fan1)·fan2(팬 2 — CP 전체 묶음 + 누가 개인 구독)·former(이전 소속사 — 누가가 이적해 나간 곳)·admin.
 */
export type DemoRole = 'agency' | 'artist' | 'fan' | 'fan2' | 'former' | 'admin';

/** 데모 로그인 칸 버튼 순서(운영자는 숨김 조건이 따로) */
export const DEMO_ROLES: DemoRole[] = ['agency', 'artist', 'fan', 'fan2', 'former', 'admin'];

export const DEMO_ROLE_EMAILS: Record<DemoRole, string> = {
  agency: 'staff@toffee.demo',
  artist: 'caramel-self@toffee.demo',
  fan: 'fan1@toffee.demo',
  fan2: 'fan2@toffee.demo',
  former: 'former-staff@toffee.demo',
  admin: 'admin@toffee.demo',
};

/** 주소의 `as` 값을 역할로 — `fan1`은 `fan`과 같음(버튼 이름이 "팬 1"이라 주소도 맞춰 받음). 모르는 값은 null */
export function parseDemoRole(value: string | null | undefined): DemoRole | null {
  const role = value === 'fan1' ? 'fan' : value;
  return isDemoRole(role) ? role : null;
}

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return !!value && Object.prototype.hasOwnProperty.call(DEMO_ROLE_EMAILS, value);
}

/** 로그인 칸에 보일 역할 버튼 — 운영자는 보일 때만 */
export function visibleDemoRoles(options: { showAdmin: boolean }): DemoRole[] {
  return DEMO_ROLES.filter((role) => role !== 'admin' || options.showAdmin);
}
