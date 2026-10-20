import { Platform } from 'react-native';

import { loadPreference, savePreference } from './preference-storage';

/**
 * 아티스트 계정 연결 링크(2026-10-19) — 로그인 안 된 채 `/link/<토큰>`을 열었으면 토큰을 기억해 두고 로그인 화면으로. 로그인(처음이면 가입)이
 * 끝나면 AuthGate가 온보딩보다 먼저 연결 화면으로 돌려보냄. 웹 소셜 로그인은 다른 사이트를 다녀와서 페이지가 새로 뜨므로 저장소에 둠.
 */
const KEY = 'pending-actor-link';
let pending: string | null = null;
let loaded: Promise<string | null> | null = null;

export function loadPendingActorLink(): Promise<string | null> {
  loaded ??= loadPreference(KEY)
    .catch(() => null)
    .then((value) => {
      pending = value;
      return value;
    });
  return loaded;
}

export function getPendingActorLink(): string | null {
  return pending;
}

export async function setPendingActorLink(token: string | null): Promise<void> {
  pending = token;
  loaded = Promise.resolve(token);
  await savePreference(KEY, token).catch(() => {});
}

// 링크 주소의 웹 도메인 — 운영 웹 주소가 정해지면 EXPO_PUBLIC_WEB_URL에(ops-infra-backlog). 운영자는 주로 PC 웹이라 그 주소를 그대로 씀
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://demo.toffeechat.app');

export function actorLinkUrl(token: string): string {
  return `${WEB_URL.replace(/\/$/, '')}/link/${encodeURIComponent(token)}`;
}
