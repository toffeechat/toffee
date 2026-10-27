import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { showInAppBanner } from '@/components/in-app-banner';
import {
  registerThisDevice,
  subscribeForegroundMessages,
  subscribeNotificationOpens,
  subscribeTokenRefresh,
  type PushData,
} from '@/lib/push';

/**
 * 로그인한 동안: 이 기기를 푸시 대상으로 등록 + 토큰 교체 감시 + 알림을 눌렀을 때 해당 화면으로 이동 +
 * 앱을 보고 있을 때 온 알림이면 그 대화를 새로 불러옴. 로그아웃 시 해제는 auth-context의 logout이 함.
 */
// 운영자 알림 종류 → 화면(2026-10-20)
const ADMIN_ALERT_SCREENS: Record<string, Href> = {
  REPORT: '/admin/reports',
  REFUND: '/admin/refunds',
  IDLE: '/admin/rooms',
  INQUIRY: '/admin/inquiries',
  CONTRACT: '/admin/actors',
  RETIRE: '/admin/store-todo',
  // Sentry 오류(2026-10-25) — 운영자 홈 "최근 오류" 카드에서 Sentry로
  ERROR: '/admin',
};

export function usePushNotifications(): void {
  const { token, role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    registerThisDevice().catch(() => {});
    // 앱으로 돌아올 때마다 다시 등록(2026-10-15 실기기) — 서버에서 기기가 빠졌을 때(데모 초기화 등) 앱을 완전히 껐다 켜기 전까지
    // 알림이 조용히 끊겼음. 서버는 같은 토큰이면 덮어쓰기만 하고, 권한 창은 처음 한 번만 뜸
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') registerThisDevice().catch(() => {});
    });
    const unsubscribeRefresh = subscribeTokenRefresh();
    return () => {
      appState.remove();
      unsubscribeRefresh();
    };
  }, [token]);

  useEffect(() => {
    if (!token || !role) return;
    // 역할마다 같은 배우의 다른 화면으로 — 팬은 채팅방, 소속사는 모니터링, 배우 본인은 스튜디오
    // 팬은 알림이 가리키는 메시지로 스크롤·강조(focus) — 인용 답장 알림이면 그 답장, 그 뒤에 새 메시지가 더 와도 찾아감
    const open = ({ type, actorId, bundleId, messageId, kind, inquiryId }: PushData) => {
      // 공지 푸시·문의 답변·운영자 알림(2026-10-20)
      if (type === 'notice') return router.push('/notices');
      if (type === 'inquiry-reply' && inquiryId) return router.push({ pathname: '/support/[id]', params: { id: inquiryId } });
      if (type === 'admin-alert' && role === 'ADMIN') {
        // 문의 알림은 그 문의로 바로(2026-10-27)
        if (kind === 'INQUIRY' && inquiryId) return router.push({ pathname: '/admin/inquiries/[id]', params: { id: inquiryId } });
        const target = ADMIN_ALERT_SCREENS[kind ?? ''];
        if (target) return router.push(target);
      }
      // 예약 오픈 알림(2026-10-19) — 아직 구독 전이라 아티스트 프로필·묶음 구독 화면으로
      if (type === 'bundle-released' && bundleId) return router.push({ pathname: '/subscribe/bundle/[bundleId]', params: { bundleId } });
      if (type === 'actor-released' && actorId) return router.push({ pathname: '/actor/[id]', params: { id: actorId } });
      if (!actorId) return;
      if (role === 'AGENCY_STAFF') router.push(`/console/${actorId}`);
      else if (role === 'ACTOR') router.push(`/studio/${actorId}`);
      else if (role === 'USER') router.push({ pathname: '/chat/[actorId]', params: { actorId, ...(messageId ? { focus: messageId } : {}) } });
    };
    // 앱을 보고 있을 때 온 알림: 해당 대화·인박스를 새로 불러오고 위쪽 배너로 알려줌(누르면 그 대화로)
    const refresh = (data: PushData) => {
      if (data.type === 'actor-released' || data.type === 'bundle-released') {
        void queryClient.invalidateQueries({ queryKey: ['actors'] });
        void queryClient.invalidateQueries({ queryKey: ['bundles'] });
        if (data.title || data.body) showInAppBanner({ title: data.title, body: data.body, actorId: data.actorId ?? '', onPress: () => open(data) });
        return;
      }
      // 공지·문의 답변·운영자 알림(2026-10-20) — 배너만(누르면 그 화면)
      if (data.type === 'notice' || data.type === 'inquiry-reply' || data.type === 'admin-alert') {
        if (data.type === 'notice') void queryClient.invalidateQueries({ queryKey: ['notices'] });
        if (data.type === 'inquiry-reply') void queryClient.invalidateQueries({ queryKey: ['support'] });
        if (data.type === 'admin-alert') void queryClient.invalidateQueries({ queryKey: ['admin'] });
        if (data.title || data.body) showInAppBanner({ title: data.title, body: data.body, actorId: '', onPress: () => open(data) });
        return;
      }
      if (!data.actorId) return;
      void queryClient.invalidateQueries({ queryKey: ['messages', data.actorId] });
      void queryClient.invalidateQueries({ queryKey: ['actor-broadcasts', data.actorId] });
      void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      if (data.title || data.body)
        showInAppBanner({
          title: data.title,
          body: data.body,
          actorId: data.actorId,
          // 아티스트 메시지 알림이면 프로필 사진(카톡처럼, 2026-10-14)
          ...(data.senderName ? { avatar: data.senderImage ?? null } : {}),
          onPress: () => open(data),
        });
    };
    const unsubscribeOpens = subscribeNotificationOpens(open);
    const unsubscribeForeground = subscribeForegroundMessages(refresh);
    return () => {
      unsubscribeOpens();
      unsubscribeForeground();
    };
  }, [token, role, router, queryClient]);
}
