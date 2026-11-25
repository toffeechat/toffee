import { loadPreference, savePreference } from './preference-storage';

/**
 * 디저트랩 다른 서비스(검볼)의 "토피로 로그인"(2026-10-28) — 로그인 안 된 채 `/connect/<client>?…`를 열었으면 주소를 기억해 두고 로그인 화면으로.
 * 로그인(처음이면 가입·온보딩)이 끝나면 AuthGate가 이 주소로 돌려보냄. 웹 소셜 로그인은 다른 사이트를 다녀오므로 저장소에 둠(actor-link와 같은 방식)
 */
const KEY = 'pending-partner-connect';
let pending: string | null = null;
let loaded: Promise<string | null> | null = null;

export function loadPendingConnect(): Promise<string | null> {
  loaded ??= loadPreference(KEY)
    .catch(() => null)
    .then((value) => {
      pending = value;
      return value;
    });
  return loaded;
}

export function getPendingConnect(): string | null {
  return pending;
}

export async function setPendingConnect(path: string | null): Promise<void> {
  pending = path;
  loaded = Promise.resolve(path);
  await savePreference(KEY, path).catch(() => {});
}
