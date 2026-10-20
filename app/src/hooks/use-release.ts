import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { isUpcoming } from '@/utils/release';

type ReleaseTarget = { kind: 'actors' | 'bundles'; id: string };

/**
 * "곧 공개" 알림 받기(2026-10-19) — 팬만. 누르면 공개 시각에 푸시 한 번. 아티스트·CP방은 /actors/:id, 묶음은 /bundles/:id
 */
export function useReleaseWatch({ kind, id }: ReleaseTarget, enabled: boolean) {
  const { token, role } = useAuth();
  const queryClient = useQueryClient();
  const key = ['release-watch', kind, id];
  const status = useQuery({
    queryKey: key,
    queryFn: () => apiClient.get<{ watching: boolean }>(`/${kind}/${id}/release-watch`),
    enabled: enabled && !!token && role === 'USER' && !!id,
  });
  const toggle = useMutation({
    mutationFn: (watch: boolean) =>
      watch ? apiClient.post<{ watching: boolean }>(`/${kind}/${id}/release-watch`) : apiClient.delete<{ watching: boolean }>(`/${kind}/${id}/release-watch`),
    onSuccess: (result) => queryClient.setQueryData(key, result),
  });
  return { watching: status.data?.watching ?? false, toggle, canWatch: !!token && role === 'USER' };
}

/** 공개 시각 전이면 true — 화면을 켜 둔 채 시각이 지나면 저절로 false로(하루 안쪽만 타이머) */
export function useUpcoming(releaseAt: string | null | undefined): boolean {
  const [, setTick] = useState(0);
  const upcoming = isUpcoming(releaseAt);
  useEffect(() => {
    if (!upcoming || !releaseAt) return;
    const wait = new Date(releaseAt).getTime() - Date.now() + 500;
    if (wait > 24 * 60 * 60 * 1000) return;
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait);
    return () => clearTimeout(timer);
  }, [upcoming, releaseAt]);
  return upcoming;
}
