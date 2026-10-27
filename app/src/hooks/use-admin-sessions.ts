import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// 회원을 모든 기기에서 로그아웃시키기(2026-10-27) — 계정 도용 의심·폰 분실. 작업 기록에 남아서 회원 상세 기록도 새로고침
export function useSignOutUserEverywhere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/admin/users/${id}/sign-out`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
