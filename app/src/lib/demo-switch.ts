import { useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from './api-client';
import { useAuth } from './auth-context';
import { DEMO_ROLE_EMAILS, loadDemoPrefs, saveDemoPrefs, SHOW_DEV_LOGIN } from './demo-entry';
import { loadPreference, savePreference } from './preference-storage';
import { onSessionReset, resetSessionState } from './session-reset';
import { loadToken } from './token-storage';
import { useMe } from '@/hooks/use-onboarding';

/**
 * 데모 역할 바꿔 보기(2026-11-24 사용자 결정 — 소속사 폰 화면 개선 4번): 소속사로 들어온 데모 방문자가 로그아웃 없이 같은 입장 코드로
 * 팬·아티스트 데모 계정으로 바꿔 들어가 봄. 바꿔 들어간 동안은 화면 위에 "소속사로 돌아가기" 띠(DemoViewFrame)가 보임.
 * 데모 계정(@toffee.demo)·데모 로그인이 켜진 빌드에서만 — 운영 앱엔 안 보이고 서버도 dev-login을 막음.
 */
export type DemoViewAs = 'fan' | 'artist';

const VIEW_KEY = 'toffee_demo_view_as';

let viewAs: DemoViewAs | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

if (SHOW_DEV_LOGIN) {
  void loadPreference(VIEW_KEY).then((value) => {
    if (value === 'fan' || value === 'artist') {
      viewAs = value;
      emit();
    }
  });
}

// 로그아웃(·로그인 끊김)하면 "보는 중" 표시도 지움(2026-11-24 점검 5차) — 예전엔 로그인 화면의 데모 로그인만 지워서, 팬 화면으로 보다가
// 로그아웃한 뒤 소셜 로그인으로 들어오면 상관없는 "소속사로 돌아가기" 띠가 다시 떴음. 역할 바꾸기도 resetSessionState를 부르므로
// switchTo가 부를 땐 건너뛰고 바로 새 값을 저장함(저장 순서가 뒤섞이지 않게)
let switching = false;
onSessionReset(() => {
  if (switching || viewAs === null) return;
  viewAs = null;
  emit();
  void savePreference(VIEW_KEY, null);
});

/** 지금 소속사에서 바꿔 들어가 보는 중인 역할(아니면 null) */
export function useDemoViewAs(): DemoViewAs | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => viewAs,
    () => viewAs,
  );
}

/** 로그인 화면에서 직접 역할을 골라 들어오면 "바꿔 보는 중"이 아님 */
export async function clearDemoViewAs(): Promise<void> {
  viewAs = null;
  emit();
  await savePreference(VIEW_KEY, null);
}

/** 데모 계정으로 들어와 있는지 — 역할 바꿔 보기·PC 링크에 입장 코드를 넣을지 판단 */
export function useIsDemoAccount(): boolean {
  const { data: me } = useMe();
  return SHOW_DEV_LOGIN && !!me?.email?.toLowerCase().endsWith('@toffee.demo');
}

/** 저장해 둔 입장 코드(로그인 화면·링크로 들어올 때 저장, 운영자 코드는 저장 안 함) */
export async function loadDemoCode(): Promise<string | null> {
  return (await loadDemoPrefs()).code;
}

/** 팬·아티스트로 바꿔 들어가기 / 소속사로 돌아오기 */
export function useDemoSwitch() {
  const { login } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<DemoViewAs | 'agency' | null>(null);
  const [failed, setFailed] = useState(false);
  const switchTo = async (target: DemoViewAs | 'agency') => {
    setBusy(target);
    setFailed(false);
    try {
      const code = await loadDemoCode();
      if (!code) throw new Error('no demo code');
      const role = target === 'artist' ? 'artist' : target === 'fan' ? 'fan' : 'agency';
      const { accessToken } = await apiClient.post<{ accessToken: string }>('/auth/dev-login', { email: DEMO_ROLE_EMAILS[role], code });
      const previousToken = await loadToken();
      // 새 계정 로그인(역할 조회)이 끝난 뒤에 "보는 중" 상태를 바꿈(2026-11-24 점검 5차) — 예전엔 먼저 바꿔서, 역할 조회가 실패하면
      // 토큰은 앞 계정으로 되돌아가는데 "소속사로 돌아가기" 띠만 사라져 돌아갈 방법이 없었음
      await login(accessToken);
      // 앞 계정 화면 데이터·못 보낸 메시지 같은 메모리 상태가 새 계정에 남지 않게(로그아웃과 같은 정리)
      queryClient.clear();
      switching = true;
      try {
        resetSessionState();
      } finally {
        switching = false;
      }
      viewAs = target === 'agency' ? null : target;
      emit();
      await Promise.all([savePreference(VIEW_KEY, viewAs), saveDemoPrefs(role, code)]);
      // 앞 계정 서버 세션은 끊음(기다리지 않음) — 안 하면 역할을 오갈 때마다 30일짜리 세션이 하나씩 남음
      if (previousToken && previousToken !== accessToken) {
        void apiClient.post('/auth/logout', undefined, { authToken: previousToken }).catch(() => {});
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };
  return { switchTo, busy, failed };
}
