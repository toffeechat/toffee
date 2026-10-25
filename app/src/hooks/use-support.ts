import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { uploadInquiryPhoto } from '@/lib/upload-media';

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
  /** 푸시를 보낸 시각(2026-10-20, 운영자 화면) */
  pushedAt?: string | null;
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

// ── 1:1 문의(2026-10-20) ──

export type InquiryCategory = 'ACCOUNT' | 'PAYMENT' | 'REFUND' | 'ARTIST' | 'BUG' | 'OTHER';
export const INQUIRY_CATEGORIES: InquiryCategory[] = ['ACCOUNT', 'PAYMENT', 'REFUND', 'ARTIST', 'BUG', 'OTHER'];
export type InquiryStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface InquirySummary {
  id: string;
  category: InquiryCategory;
  title: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
}

/** 붙인 사진(2026-10-25) — url은 서버가 준 임시 주소, 저장소가 안 되면 null */
export interface InquiryPhoto {
  id: string;
  url: string | null;
}

export interface InquiryDetail extends InquirySummary {
  messages: { id: string; fromAdmin: boolean; body: string; createdAt: string; attachments: InquiryPhoto[] }[];
}

/** 글 하나에 붙일 수 있는 사진 — 서버 INQUIRY_PHOTO_MAX와 같게 */
export const INQUIRY_PHOTO_MAX = 3;

/** 고른 사진(아직 안 올린 것) — 보낼 때 올림 */
export interface PickedPhoto {
  uri: string;
  mimeType?: string;
}

/** 고른 사진을 차례로 올리고 키 목록을 돌려줌(회원·운영자 공통) */
export async function uploadInquiryPhotos(photos: PickedPhoto[]): Promise<string[]> {
  const keys: string[] = [];
  for (const photo of photos) keys.push(await uploadInquiryPhoto(photo.uri, photo.mimeType));
  return keys;
}

export function useMyInquiries() {
  return useQuery({ queryKey: ['support', 'inquiries'], queryFn: () => apiClient.get<InquirySummary[]>('/support/inquiries') });
}

export function useMyInquiry(id: string) {
  return useQuery({ queryKey: ['support', 'inquiries', id], queryFn: () => apiClient.get<InquiryDetail>(`/support/inquiries/${id}`), enabled: !!id, refetchInterval: 30_000 });
}

export function useCreateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ photos, ...input }: { category: InquiryCategory; title: string; body: string; photos: PickedPhoto[] }) =>
      apiClient.post<InquiryDetail>('/support/inquiries', { ...input, photoKeys: await uploadInquiryPhotos(photos) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });
}

export function useAddInquiryMessage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photos }: { body: string; photos: PickedPhoto[] }) =>
      apiClient.post<InquiryDetail>(`/support/inquiries/${id}/messages`, { body, photoKeys: await uploadInquiryPhotos(photos) }),
    onSuccess: (data) => {
      queryClient.setQueryData(['support', 'inquiries', id], data);
      void queryClient.invalidateQueries({ queryKey: ['support', 'inquiries'], exact: true });
    },
  });
}

/** 내 문의 지우기(2026-10-25) — 붙인 사진도 같이 지워짐 */
export function useDeleteInquiry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ deleted: boolean }>(`/support/inquiries/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['support', 'inquiries', id] });
      void queryClient.invalidateQueries({ queryKey: ['support', 'inquiries'], exact: true });
    },
  });
}
