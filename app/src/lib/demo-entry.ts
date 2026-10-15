import { Platform } from 'react-native';

import { loadPreference, savePreference } from './preference-storage';

/**
 * 데모 로그인 간소화(2026-10-15 사용자 결정): 이메일을 치는 대신 [소속사][아티스트][팬][운영자] 중 하나를 고르고 입장 코드만.
 * 고르면 정해진 데모 계정(서버 `demo-seed.ts`의 고정 계정)으로 dev-login. 운영자는 서버가 운영자 코드(`DEV_LOGIN_ADMIN_CODE`)를
 * 따로 요구하므로 소속사용 코드로는 못 들어감.
 *
 * 웹 링크로 바로 입장: `demo.toffeechat.app/?demo=<입장 코드>&as=agency&lang=th` — 누르면 입력 없이 그 역할로 로그인.
 * (`code`가 아니라 `demo`인 건 PC 웹 소셜 로그인 복귀 주소 `/oauth/<회사>?code=…`와 겹치지 않게)
 */
/** 데모 로그인 칸이 보이는 빌드인지 — 개발 빌드나 EXPO_PUBLIC_ENABLE_DEV_LOGIN=true(웹 데모·preview 앱). 운영 빌드엔 안 보이고 서버도 막음 */
export const SHOW_DEV_LOGIN = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_LOGIN === 'true';

export type DemoRole = 'agency' | 'artist' | 'fan' | 'admin';

export const DEMO_ROLES: DemoRole[] = ['agency', 'artist', 'fan', 'admin'];

export const DEMO_ROLE_EMAILS: Record<DemoRole, string> = {
  agency: 'staff@toffee.demo',
  artist: 'caramel-self@toffee.demo',
  fan: 'fan1@toffee.demo',
  admin: 'admin@toffee.demo',
};

export function isDemoRole(value: string | null | undefined): value is DemoRole {
  return !!value && (DEMO_ROLES as string[]).includes(value);
}

export interface DemoLink {
  role: DemoRole | null;
  code: string | null;
}

/**
 * 첫 주소의 `demo`·`as`를 앱이 뜨자마자 한 번만 읽어 둠 — 로그인 안 된 상태로 들어오면 AuthGate가 곧바로 `/login`으로 옮기면서
 * 주소의 검색어가 사라지기 때문. 읽은 뒤엔 주소창에서 지움(입장 코드가 화면·공유 주소에 남지 않게, `lang` 같은 나머지는 그대로).
 */
function readLinkOnce(): DemoLink | null {
  if (!SHOW_DEV_LOGIN || Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('demo')?.trim() || null;
    const as = params.get('as');
    if (!code && !as) return null;
    params.delete('demo');
    params.delete('as');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    return { role: isDemoRole(as) ? as : null, code };
  } catch {
    return null;
  }
}

let pendingLink = readLinkOnce();

/** 링크로 들어왔으면 그 내용(아직 로그인에 안 쓴 것만) */
export function peekDemoLink(): DemoLink | null {
  return pendingLink;
}

/** 링크 내용을 로그인 화면이 가져감 — 한 번만(로그아웃 후 다시 자동 로그인되지 않게) */
export function takeDemoLink(): DemoLink | null {
  const link = pendingLink;
  pendingLink = null;
  return link;
}

// 입장 코드·마지막으로 고른 역할을 기억 — 다음에 들어올 땐 버튼만 누르면 되게(웹은 localStorage, 앱은 SecureStore)
const CODE_KEY = 'toffee_demo_code';
const ROLE_KEY = 'toffee_demo_role';

export async function loadDemoPrefs(): Promise<{ code: string | null; role: DemoRole | null }> {
  const [code, role] = await Promise.all([loadPreference(CODE_KEY), loadPreference(ROLE_KEY)]);
  return { code, role: isDemoRole(role) ? role : null };
}

export async function saveDemoPrefs(role: DemoRole | null, code: string): Promise<void> {
  // 운영자 코드는 기억하지 않음 — 같은 PC를 다른 사람이 쓰면 운영자 화면이 열리지 않게
  if (role === 'admin') return;
  await Promise.all([savePreference(CODE_KEY, code || null), savePreference(ROLE_KEY, role)]);
}
