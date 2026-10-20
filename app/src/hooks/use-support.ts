import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export interface FaqSection {
  title: string;
  items: { q: string; a: string }[];
}

/** 자주 묻는 질문 — 서버가 원본(backend/src/legal/faq-texts.ts), 공개 웹페이지 /faq와 같은 글. 앱 언어로 받음 */
export function useFaq() {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['faq', i18n.language],
    queryFn: () => apiClient.get<{ title: string; sections: FaqSection[] }>(`/faq/items?lang=${encodeURIComponent(i18n.language)}`),
    staleTime: 60 * 60 * 1000,
  });
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 공지사항(운영자가 씀) — 고정 공지 먼저, 그다음 최신순 */
export function useNotices() {
  const { token } = useAuth();
  return useQuery({ queryKey: ['notices'], queryFn: () => apiClient.get<Notice[]>('/notices'), enabled: !!token });
}

/** 공지 번역(2026-10-20) — 한국어로 쓴 공지를 내 앱 언어로. 서버가 공지 × 언어마다 한 번 번역해 저장 */
export function useTranslateNotice(id: string) {
  return useMutation({
    mutationFn: (targetLanguage: string) => apiClient.post<{ language: string; title: string; body: string }>(`/notices/${id}/translate`, { targetLanguage }),
  });
}
