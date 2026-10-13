import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { showInAppBanner } from '@/components/in-app-banner';
import type { Actor } from '@/hooks/use-actors';
import { useMe } from '@/hooks/use-onboarding';
import { useAuth } from '@/lib/auth-context';
import { onRealtimeEvent } from '@/lib/realtime';

/*
 * 소속사 PC 웹 새 메시지 알림(2026-10-13 사용자 결정, 1차) — 웹엔 푸시가 없어서, 탭을 열어 둔 동안 실시간 신호(SSE)로:
 * 화면 위 배너(누르면 그 아티스트 모니터링), 브라우저 탭 제목 "(3) Toffee", 소속 아티스트 목록의 "새 메시지" 점.
 * 그 아티스트 화면을 열면 지워짐. 앱은 기존 푸시(+ 앱 사용 중 배너)를 그대로 써서 여기선 웹만. 브라우저를 닫아도 오는 웹 푸시는 2차.
 */

const unread = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, number> = new Map();

function emit() {
  snapshot = new Map(unread);
  listeners.forEach((listener) => listener());
}

export function markConsoleActorSeen(actorId: string) {
  if (!unread.has(actorId)) return;
  unread.delete(actorId);
  emit();
}

/** 아티스트별 안 본 새 메시지 수(웹 소속사 화면만 채워짐) */
export function useConsoleUnread(): ReadonlyMap<string, number> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** 로그인한 소속사 직원이 PC 웹에 있을 때만 동작 — _layout의 SessionEffects에서 */
export function useConsoleWebAlerts() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const counts = useConsoleUnread();
  const { data: me } = useMe();
  // 설정 > 알림의 "아티스트 새 메시지 알림"을 끄면 웹 배너·점도 끔(앱 푸시와 같은 설정)
  const enabled = Platform.OS === 'web' && role === 'AGENCY_STAFF' && me?.notifyArtistMessages !== false;

  useEffect(() => {
    if (!enabled) return;
    return onRealtimeEvent((event) => {
      if (event.kind !== 'artist-message' || !event.actorId) return;
      const actorId = event.actorId;
      // 목록의 "마지막 메시지 N일 전"·대시보드 숫자도 새로
      void queryClient.invalidateQueries({ queryKey: ['my-actors'] });
      void queryClient.invalidateQueries({ queryKey: ['agency-dashboard'] });
      // 이미 그 아티스트 모니터링을 보고 있으면 배너·점 없이(목록은 실시간 신호로 이미 새로고침됨)
      if (window.location.pathname.includes(actorId)) return;
      unread.set(actorId, (unread.get(actorId) ?? 0) + 1);
      emit();
      const actor = queryClient.getQueryData<Actor[]>(['my-actors'])?.find((row) => row.id === actorId);
      showInAppBanner({
        title: t('consoleAlerts.newMessage', { name: actor?.chatDisplayName ?? t('consoleAlerts.anArtist') }),
        body: t('consoleAlerts.tapToView'),
        actorId,
        onPress: () => router.push(`/console/${actorId}`),
      });
    });
  }, [enabled, queryClient, router, t]);

  // 그 아티스트 화면을 열면 지움
  useEffect(() => {
    const match = /^\/console\/([^/]+)$/.exec(pathname);
    if (match) markConsoleActorSeen(match[1]);
  }, [pathname]);

  // 탭 제목에 안 본 수 — 다른 탭을 보고 있어도 보이게. 화면마다 제목이 바뀌므로 경로가 바뀔 때도 다시 붙임
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const total = enabled ? [...counts.values()].reduce((a, b) => a + b, 0) : 0;
    const apply = () => {
      const base = document.title.replace(/^\(\d+\)\s*/, '');
      const next = total > 0 ? `(${total}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // 라우터가 화면 제목을 늦게 바꾸는 경우까지
    const timer = setTimeout(apply, 300);
    return () => clearTimeout(timer);
  }, [counts, enabled, pathname]);
}
