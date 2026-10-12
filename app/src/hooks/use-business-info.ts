import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// 서버 backend/src/legal/business-info.ts의 BUSINESS_FIELDS와 같은 순서
export const BUSINESS_FIELDS = ['name', 'representative', 'address', 'phone', 'email', 'registrationNumber', 'mailOrderNumber'] as const;
export type BusinessInfo = Partial<Record<(typeof BUSINESS_FIELDS)[number], string>>;

/** 사업자 정보(전자상거래법 표시) — 사업자 등록 전이면 null이라 화면에 안 나옴 */
export function useBusinessInfo() {
  return useQuery({
    queryKey: ['business-info'],
    queryFn: async () => (await apiClient.get<{ info: BusinessInfo | null }>('/legal/business-info')).info,
    staleTime: 60 * 60 * 1000,
  });
}
