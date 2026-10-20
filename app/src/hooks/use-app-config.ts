import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** 앱 설정(2026-10-20) — 점검 모드·앱 최소 버전. 로그인 전에도, 1분마다·앱으로 돌아올 때 다시 */
export interface AppConfig {
  maintenance: { on: boolean; message: string | null; until: string | null };
  minVersion: { ios: string | null; android: string | null };
}

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: () => apiClient.get<AppConfig>('/app-config'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    // 서버가 잠깐 안 될 때 화면을 막지 않게(점검 화면은 설정을 받아야만)
    retry: 1,
  });
}
