import { signOutProviders } from '@/lib/social-sign-in';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import { getCachedToken, loadToken, saveToken, removeToken } from './token-storage';
import { apiClient, ApiError, onUnauthorized } from './api-client';
import { resetSessionState } from './session-reset';
import type { Role } from './types';
import { setAppBadgeCount, unregisterThisDevice } from '@/lib/push';

interface AuthContextValue {
  token: string | null;
  role: Role | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 모든 기기에서 로그아웃(2026-10-27) — 서버가 이 계정의 모든 토큰을 끊은 뒤 이 기기도 로그아웃. 서버 요청이 실패하면 던짐 */
  logoutAll: () => Promise<void>;
  /** 서버에서 역할을 다시 읽음 — 연결 링크로 아티스트 계정이 됐을 때(2026-10-19) */
  refreshRole: () => Promise<void>;
  /** 정지·영구차단 등으로 로그인이 끊긴 이유(로그인 화면에 보여줌) */
  signedOutReason: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchRole(): Promise<Role> {
  const me = await apiClient.get<{ id: string; role: Role }>('/auth/me');
  return me.role;
}

// 역할 조회를 잠깐 기다렸다 몇 번 더(2026-10-27) — 예전엔 오류를 전부 삼켜서 순간 끊김·서버 재시작 한 번에 그 세션 내내 role이 null
// (아티스트가 팬 탭에 떨어지고, 로그인 버튼은 아무 반응 없이 끝남). 401은 다시 해도 소용없어서 바로 던짐(로그아웃은 api-client가 처리)
async function fetchRoleWithRetry(attempts = 3): Promise<Role> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchRole();
    } catch (error) {
      if (attempt >= attempts || (error instanceof ApiError && error.status === 401)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// 로그아웃 뒤 마무리 요청(푸시 해제·소셜 로그아웃)을 기다리는 최대 시간 — 오프라인에서도 로그아웃이 바로 끝나게
const LOGOUT_CLEANUP_MS = 3000;

// 토큰 자동 갱신(2026-10-27) — 켤 때 한 번 + 앱으로 돌아올 때 12시간에 한 번 /auth/refresh로 만료(30일)를 미룸. 자주 쓰는 사람은
// 다시 로그인할 일이 없고, 서버는 세션 단위로 끊을 수 있음. 마지막 갱신 시각은 메모리에만(앱을 새로 켜면 한 번 갱신)
const TOKEN_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastTokenRefreshAt = 0;
let tokenRefreshing = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signedOutReason, setSignedOutReason] = useState<string | null>(null);
  // 토큰은 있는데 역할을 못 받음(오프라인·서버 오류) — 아래에서 다시 시도
  const [roleFailed, setRoleFailed] = useState(false);
  // 로그아웃하면 화면 캐시도 비움 — 안 그러면 같은 기기로 다음 사람이 로그인했을 때 앞 사람 대화 목록이 잠깐 보임
  const queryClient = useQueryClient();

  const applyRole = (fetchedRole: Role) => {
    // 앱 아이콘 숫자는 팬 대화 탭만 채움 — 아티스트·소속사·운영자 계정이면 0으로(2026-10-12 실기기: 같은 폰에서 쓰던 팬 계정 숫자가
    // 소속사 계정에도 남아 "무슨 알림인지 모르겠음")
    if (fetchedRole !== 'USER') setAppBadgeCount(0);
    setRole(fetchedRole);
    setRoleFailed(false);
  };

  useEffect(() => {
    loadToken().then(async (storedToken) => {
      setToken(storedToken);
      if (storedToken) {
        try {
          applyRole(await fetchRoleWithRetry());
        } catch (error) {
          // 401이면 api-client가 이미 로그아웃 처리. 그 밖(오프라인·5xx)은 토큰을 지우지 않고 뒤에서 다시 시도
          if (!(error instanceof ApiError && error.status === 401)) setRoleFailed(true);
        }
      }
      setIsLoading(false);
    });
    // 앱이 뜰 때 한 번
  }, []);

  // 역할 다시 받기(2026-10-27) — 점점 길게(최대 30초) + 앱으로 돌아올 때·인터넷이 다시 연결될 때 바로
  useEffect(() => {
    if (!token || role || !roleFailed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = 2000;
    let running = false;
    const attempt = async () => {
      if (cancelled || running) return;
      running = true;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        const fetchedRole = await fetchRole();
        if (!cancelled) applyRole(fetchedRole);
        return;
      } catch (error) {
        if (cancelled || (error instanceof ApiError && error.status === 401)) return;
      } finally {
        running = false;
      }
      timer = setTimeout(() => void attempt(), delay);
      delay = Math.min(delay * 2, 30_000);
    };
    timer = setTimeout(() => void attempt(), delay);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void attempt();
    });
    const network = addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void attempt();
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      appState.remove();
      network.remove();
    };
  }, [token, role, roleFailed]);

  // 토큰 자동 갱신 — 역할까지 받은 뒤(로그인 확인이 끝난 뒤). 새 토큰으로 바뀌면 실시간 연결은 useRealtimeSync(token)가 다시 붙음.
  // 실패는 무시(401이면 api-client가 로그아웃 처리, 오프라인이면 다음에 앱으로 돌아올 때)
  useEffect(() => {
    if (!token || !role) return;
    const maybeRefresh = async () => {
      if (tokenRefreshing || Date.now() - lastTokenRefreshAt < TOKEN_REFRESH_INTERVAL_MS) return;
      tokenRefreshing = true;
      try {
        const { accessToken } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        lastTokenRefreshAt = Date.now();
        // 갱신하는 사이에 로그아웃·다른 계정 로그인·2단계 인증 새 토큰이 있었으면 버림
        if (getCachedToken() !== token) return;
        await saveToken(accessToken);
        setToken(accessToken);
      } catch {
        // 위 주석대로 무시
      } finally {
        tokenRefreshing = false;
      }
    };
    void maybeRefresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void maybeRefresh();
    });
    return () => appState.remove();
  }, [token, role]);

  // 서버가 이 토큰을 더 이상 안 받아주면(정지·영구차단·만료) 로그아웃하고 이유를 남김 — 예전엔 모든 화면이
  // 오류만 나는 상태로 멈춰 있었음. 푸시 해제는 어차피 401이라 건너뜀.
  useEffect(() => {
    onUnauthorized((message) => {
      void removeToken();
      setToken(null);
      setRole(null);
      setRoleFailed(false);
      setSignedOutReason(message);
      queryClient.clear();
      resetSessionState();
    });
    return () => onUnauthorized(null);
  }, [queryClient]);

  const login = async (newToken: string) => {
    setSignedOutReason(null);
    await saveToken(newToken);
    // role까지 먼저 구해서 token/role을 한 틱에 같이 반영 — 안 그러면 AuthGate가
    // "토큰은 있는데 role은 아직 null"인 중간 상태에서 팬 화면으로 잘못 리다이렉트함
    let fetchedRole: Role;
    try {
      fetchedRole = await fetchRoleWithRetry();
    } catch (error) {
      // 정지·차단 계정이면 /auth/me가 401 → onUnauthorized가 이미 로그아웃 처리하고 이유를 남김. 그 밖의 실패면 저장한 토큰을 지움.
      // 어느 쪽이든 던져서 화면이 오류를 보여 주게(2026-10-27 — 예전엔 조용히 끝나서 로그인 버튼·PC 웹 소셜 로그인 화면이 멈춘 듯 보였음)
      if (!(error instanceof ApiError && error.status === 401)) await removeToken();
      throw error;
    }
    // 막 받은 토큰이라 바로 갱신하지 않음
    lastTokenRefreshAt = Date.now();
    setToken(newToken);
    applyRole(fetchedRole);
  };

  const refreshRole = async () => {
    try {
      applyRole(await fetchRole());
    } catch {
      // 401은 api-client가 로그아웃 처리, 그 밖엔 지금 역할을 그대로 둠
    }
  };

  const logout = async () => {
    // 이 기기 상태부터 바로 비움(2026-10-27) — 예전엔 푸시 해제·소셜 로그아웃 요청을 먼저 기다려서 오프라인이면 로그아웃이 멈춤.
    // 푸시 해제는 저장된 토큰을 지운 뒤라 지우기 전 토큰을 직접 넘김(안 하면 같은 폰의 다음 사람에게 앞 사람 알림이 감)
    const authToken = (await loadToken()) ?? token ?? undefined;
    await removeToken();
    setAppBadgeCount(0);
    setToken(null);
    setRole(null);
    setRoleFailed(false);
    queryClient.clear();
    resetSessionState();
    // 마무리는 기다리지 않음 — 최대 3초 뒤 끊음. 소셜 SDK 세션 정리는 다음 로그인 때 다른 계정을 고를 수 있게(실패해도 무시)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_CLEANUP_MS);
    // 서버 세션도 끊음(2026-10-27) — 토큰이 남아 있어도(백업·유출) 더 못 쓰게
    void Promise.allSettled([
      authToken ? apiClient.post('/auth/logout', undefined, { authToken, signal: controller.signal }) : Promise.resolve(),
      authToken ? unregisterThisDevice({ authToken, signal: controller.signal }) : Promise.resolve(),
      Promise.race([signOutProviders(), new Promise((resolve) => setTimeout(resolve, LOGOUT_CLEANUP_MS))]),
    ]).finally(() => clearTimeout(timer));
  };

  const logoutAll = async () => {
    // 푸시 해제를 먼저 — 모든 기기 로그아웃 뒤엔 이 토큰으로 해제할 수 없어서 이 폰에 알림이 계속 옴(최대 3초만 기다림)
    const authToken = (await loadToken()) ?? token ?? undefined;
    if (authToken) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOGOUT_CLEANUP_MS);
      await unregisterThisDevice({ authToken, signal: controller.signal })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    }
    await apiClient.post('/auth/logout-all');
    lastTokenRefreshAt = 0;
    await logout();
  };

  return (
    <AuthContext.Provider value={{ token, role, isLoading, login, logout, logoutAll, refreshRole, signedOutReason }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
