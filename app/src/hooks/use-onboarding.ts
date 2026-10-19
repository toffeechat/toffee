import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { shouldAutoTranslate } from '@/utils/auto-translate';

export type ParentalConsentStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'UNDERAGE';

export interface OnboardingStatus {
  needsTerms: boolean;
  needsBirthDate: boolean;
  needsNickname: boolean;
  /** 첫 답장 전 메시지 이용 규칙 동의가 아직 없음 — 온보딩 단계가 아니라 채팅방에서 첫 답장 직전에 물어봄 */
  needsReplyRules?: boolean;
  parentalConsentStatus: ParentalConsentStatus;
  /** 성인만 가입일 때 가입 가능한 나이(그 나라 성년 나이). 부모 동의 방식이면 null */
  minimumAge: number | null;
}

export function useOnboardingStatus() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => apiClient.get<OnboardingStatus>('/me/onboarding-status'),
    enabled: !!token,
  });
}

// 약관 버전 — 서버 CURRENT_TERMS_VERSION(backend/src/common/legal/terms.ts)과 같게. 약관 화면 내용을 바꾸면 둘 다 올릴 것
export const TERMS_VERSION = '2026-10-12';

// 첫 답장 전 "명예훼손·사생활 침해 금지, 위반 시 제재·처벌" 안내 동의(버블 방식, 2026-10-12) — 서버에 시각 기록
export function useAcceptReplyRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<OnboardingStatus>('/me/reply-rules-agreement', {}),
    onSuccess: (status) => queryClient.setQueryData(['onboarding-status'], status),
  });
}

export function useAcceptTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    // 가입 첫 단계라 기기 지역(국가별 미성년 기준·통계용)과 플랫폼도 같이 보냄
    mutationFn: () =>
      apiClient.post<OnboardingStatus>('/me/terms-agreement', {
        version: TERMS_VERSION,
        agreeTerms: true,
        agreePrivacy: true,
        countryCode: getLocales()[0]?.regionCode ?? undefined,
        platform: Platform.OS,
      }),
    onSuccess: (status) => queryClient.setQueryData(['onboarding-status'], status),
  });
}

export function useSetBirthDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (birthDate: string) =>
      apiClient.patch<{ parentalConsentStatus: ParentalConsentStatus }>('/me/birth-date', { birthDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }),
  });
}

export function useRequestParentalConsent() {
  return useMutation({
    mutationFn: (parentEmail: string) => apiClient.post('/me/parental-consent', { parentEmail }),
  });
}

export interface Me {
  id: string;
  role: string;
  locale: string | null;
  nickname: string | null;
  /** 다음에 닉네임을 바꿀 수 있는 시각(없으면 지금 바로 가능) */
  nicknameChangeAvailableAt: string | null;
  /** 생일 축하 메시지 받기(2026-10-12) — 생년월일 자체는 안 내려오고 있는지만 */
  birthdayGreetingsEnabled?: boolean;
  hasBirthDate?: boolean;
  /** 2026-10-12 실기기 피드백 — 가입 이메일(애플 "이메일 가리기"면 중계 주소, 없을 수도 있음)과 로그인 수단(처음 가입한 것이 맨 앞) */
  email?: string | null;
  loginProviders?: ('GOOGLE' | 'APPLE' | 'NAVER' | 'KAKAO' | 'LINE')[];
  /** 팬 프로필 사진(임시 조회 주소)·상태메시지 */
  profileImageUrl?: string | null;
  statusMessage?: string | null;
  /** 역할별 알림 설정 — 소속사: 아티스트 새 메시지·스토리 / 아티스트·소속사: 장기 미발송 알림 */
  notifyArtistMessages?: boolean;
  notifyIdleAlerts?: boolean;
  /** 메시지 자동 번역(2026-10-16, 기본 켜짐) */
  autoTranslate?: boolean;
  /** 아티스트·소속사 화면의 팬 답장도 자동 번역할지 — 서버 설정 TRANSLATION_AUTO_FAN_REPLIES(2026-10-19, 기본 꺼짐) */
  autoTranslateFanReplies?: boolean;
  /** 소속사 직원이면 소속사 이름(콘솔 왼쪽 위 표시) */
  agencyName?: string | null;
}

export function useMe() {
  const { token } = useAuth();
  return useQuery({ queryKey: ['me'], queryFn: () => apiClient.get<Me>('/auth/me'), enabled: !!token });
}

// 닉네임 정하기/바꾸기 — 규칙(20자, 예약어, 7일에 한 번)은 서버가 검사하고 이유를 메시지로 돌려줌
export function useUpdateNickname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) => apiClient.patch<Me>('/auth/me/nickname', { nickname }),
    onSuccess: (me) => {
      queryClient.setQueryData(['me'], me);
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      // 채팅방의 {{name}} 자리도 새 닉네임으로
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// 생일 축하 메시지 받기 켜기/끄기 — 생년월일을 연령 확인 외 목적으로 쓰는 거라 본인이 켤 때만(기본 꺼짐)
export function useSetBirthdayGreetings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => apiClient.patch<Me>('/auth/me/birthday-greetings', { enabled }),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

// 회원 탈퇴 — 성공하면 호출한 쪽에서 로그아웃
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => apiClient.delete('/auth/me') });
}

// 팬 프로필(2026-10-12) — 상태메시지(빈 문자열이면 지움)·사진 키(null이면 기본 이미지). 규칙(60자·금칙어)은 서버가 검사
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { statusMessage?: string; profileImageKey?: string | null }) => apiClient.patch<Me>('/auth/me/profile', changes),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

/**
 * 메시지 자동 번역이 켜져 있는지 — 내 정보를 받기 전엔 꺼진 것으로(끈 사람에게 잠깐이라도 번역 요청이 가지 않게). 팬 답장(아티스트·소속사
 * 화면)은 서버 설정까지 켜져 있어야(2026-10-19, 기본 꺼짐)
 */
export function useAutoTranslate(kind: 'artistMessage' | 'fanReply' = 'artistMessage'): boolean {
  const { data: me } = useMe();
  return shouldAutoTranslate(me, kind);
}

export function useUpdateTranslationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (autoTranslate: boolean) => apiClient.patch<Me>('/auth/me/translation-settings', { autoTranslate }),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

// 역할별 알림 설정(2026-10-12)
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: { notifyArtistMessages?: boolean; notifyIdleAlerts?: boolean }) =>
      apiClient.patch<Me>('/auth/me/notification-settings', settings),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}
