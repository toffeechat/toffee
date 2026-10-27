import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { fetch } from 'expo/fetch';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { API_URL } from './env';
import { reportUnauthorized } from './api-client';
import i18n from '@/i18n';

/**
 * 실시간 신호(서버 `GET /realtime`, SSE) — 서버는 "어느 배우 채팅방이 바뀌었는지"만 보내고 내용은 안 보냄.
 * 앱은 신호를 받으면 해당 목록을 평소 API로 다시 불러옴(react-query invalidate). 연결이 살아 있는 동안엔
 * 폴링을 길게(30초, 혹시 놓친 신호 대비), 끊겨 있으면 예전처럼 짧게 — `useLiveInterval` (2026-09-29)
 */
export interface RealtimeEvent {
  /** resync: 서버가 신호를 놓쳤을 수 있음(서버의 DB 신호 연결이 끊겼다 붙음, 2026-10-25) — 보고 있는 목록을 전부 다시 불러옴 */
  kind: 'artist-message' | 'message-removed' | 'fan-reply' | 'access-changed' | 'resync';
  actorId?: string;
  messageId?: string;
}

// 실시간 신호로 새로고침하는 목록 전부(방 구분 없이) — 다시 연결됐을 때·resync. 화면에 떠 있는 것만 실제로 다시 받음(react-query)
const LIVE_QUERY_ROOTS = ['messages', 'chat-media', 'reply-quota', 'my-subscriptions', 'my-bundles', 'actor-broadcasts', 'actor-replies', 'my-actors'];

/** 끊겨 있던 동안(또는 서버가 놓친) 신호 메우기 — 놓친 메시지를 빠짐없이 다시 받음 */
export function refreshLiveQueries(queryClient: QueryClient) {
  for (const root of LIVE_QUERY_ROOTS) void queryClient.invalidateQueries({ queryKey: [root] });
}

let connected = false;
const listeners = new Set<() => void>();
function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => false);
}

/** 실시간 연결 중이면 느린 폴링(놓친 신호 대비), 아니면 원래 간격 */
export function useLiveInterval(fallbackMs: number): number {
  return useRealtimeConnected() ? 30_000 : fallbackMs;
}

// 목록 새로고침 말고 따로 반응해야 하는 곳(소속사 PC 웹 새 메시지 알림, 2026-10-13)이 듣는 곳
const eventListeners = new Set<(event: RealtimeEvent) => void>();
export function onRealtimeEvent(listener: (event: RealtimeEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function applyEvent(queryClient: QueryClient, event: RealtimeEvent) {
  eventListeners.forEach((listener) => listener(event));
  if (event.kind === 'resync') {
    refreshLiveQueries(queryClient);
    return;
  }
  // 내 구독이 바뀜(다른 기기에서 구독·해지 등) — 인박스·구독 관리. 서버도 이 연결이 받을 방 목록을 바로 다시 읽음
  if (event.kind === 'access-changed') {
    void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
    void queryClient.invalidateQueries({ queryKey: ['my-bundles'] });
    return;
  }
  const { actorId } = event;
  if (!actorId) return;
  if (event.kind === 'fan-reply') {
    // 스타 화면(답장 줄·답장 수)·답장 채팅·소속사 답장 탭
    void queryClient.invalidateQueries({ queryKey: ['actor-broadcasts', actorId] });
    void queryClient.invalidateQueries({ queryKey: ['actor-replies', actorId] });
    return;
  }
  // 팬 답장 회수(2026-10-14)도 message-removed로 와서 아래에서 같이 새로고침
  // 스타 메시지 도착·삭제 — 팬 채팅방·남은 답장 수·인박스, 스타·소속사 메시지 목록
  void queryClient.invalidateQueries({ queryKey: ['messages', actorId] });
  void queryClient.invalidateQueries({ queryKey: ['chat-media', actorId] });
  void queryClient.invalidateQueries({ queryKey: ['reply-quota', actorId] });
  void queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
  void queryClient.invalidateQueries({ queryKey: ['actor-broadcasts', actorId] });
  void queryClient.invalidateQueries({ queryKey: ['actor-replies', actorId] });
  // 스튜디오·소속사 토피룸 목록의 마지막 메시지(2026-10-14)
  void queryClient.invalidateQueries({ queryKey: ['my-actors'] });
}

// 이만큼 아무것도 안 오면 죽은 연결로 봄 — 서버 ping 간격(25초)의 약 3배
const STALL_MS = 70_000;

/** SSE 본문을 한 덩어리씩 잘라 이벤트로 — "event: x\ndata: {...}\n\n" */
function parseBlock(block: string): { type: string; data: string } | null {
  let type = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return data.length || type !== 'message' ? { type, data: data.join('\n') } : null;
}

/**
 * 로그인한 동안 연결을 유지(앱이 뒤로 가면 끊고, 돌아오면 다시). 끊기면 1초 → 최대 30초 간격으로 재시도.
 * 구독이 바뀌면 서버가 access-changed 신호로 받을 채팅방 목록을 알아서 다시 읽음(예전엔 앱이 다시 연결했음).
 */
export function useRealtimeSync(token: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;
    // 연결이 됐다가(ready) 끊긴 적이 있음 — 다음에 다시 붙으면(ready) 그 사이 놓친 신호를 메우려고 목록을 다시 불러옴(2026-10-25. 예전엔
    // 다시 붙어도 그냥 신호만 기다려서, 끊긴 동안 온 메시지는 30초 폴링이나 다음 신호 때에야 보였음 — 배포 때마다 생기는 일)
    let missed = false;

    const scheduleRetry = () => {
      if (stopped || retryTimer || AppState.currentState !== 'active') return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delay);
      delay = Math.min(delay * 2, 30_000);
    };

    const connect = async () => {
      if (stopped || controller) return;
      const current = new AbortController();
      controller = current;
      let ready = false;
      // 조용히 죽은 연결(와이파이 ↔ 데이터 전환 등 — 끊겼다는 신호 없이 멈춤) 감시: 서버는 25초마다 ping을 보내니 70초 동안 아무것도
      // 안 오면 끊고 다시 연결(2026-10-25. 예전엔 "연결됨"으로 남아서 새 메시지가 30초 폴링으로만 보였음)
      let lastData = Date.now();
      let stalled = false;
      const watchdog = setInterval(() => {
        if (Date.now() - lastData < STALL_MS) return;
        stalled = true;
        current.abort();
      }, 10_000);
      try {
        const res = await fetch(`${API_URL}/realtime`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Accept-Language': i18n.language },
          signal: current.signal,
        });
        // 로그인이 끊김(정지·만료 등, 2026-10-27) — 예전엔 401도 30초마다 영원히 재시도했음. 다시 붙지 않고 일반 요청과 같은 로그아웃
        // 처리(운영자 2단계 인증이면 코드 화면 — 새 토큰으로 바뀌면 이 효과가 다시 돌며 연결)
        if (res.status === 401) {
          const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
          stopped = true;
          const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
          reportUnauthorized(body.code, message ?? i18n.t('common.requestFailed', { status: 401 }));
          return;
        }
        if (!res.ok || !res.body) throw new Error(`realtime ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          lastData = Date.now();
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let end = buffer.indexOf('\n\n');
          while (end >= 0) {
            const event = parseBlock(buffer.slice(0, end));
            buffer = buffer.slice(end + 2);
            end = buffer.indexOf('\n\n');
            if (!event) continue;
            if (event.type === 'ready') {
              ready = true;
              setConnected(true);
              delay = 1000;
              if (missed) {
                missed = false;
                refreshLiveQueries(queryClient);
              }
            } else if (event.type === 'change') {
              try {
                applyEvent(queryClient, JSON.parse(event.data) as RealtimeEvent);
              } catch {
                // 모르는 신호는 무시
              }
            }
          }
        }
      } catch {
        // 연결 실패·끊김 — 아래에서 재시도
      } finally {
        clearInterval(watchdog);
        // 앱이 뒤로 가서 끊은 건 빼고(돌아오면 포커스 새로고침이 메움) — 서버 배포·망 끊김·멈춘 연결이면 다음 연결 때 메움
        if (ready && (stalled || !current.signal.aborted)) missed = true;
        if (controller === current) controller = null;
        setConnected(false);
      }
      scheduleRetry();
    };

    const disconnect = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      controller?.abort();
      controller = null;
      setConnected(false);
    };

    void connect();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        delay = 1000;
        // 뒤에 있는 동안 놓친 신호는 react-query 포커스 새로고침(_layout의 focusManager)이 메움
        void connect();
      } else if (state === 'background') {
        disconnect();
      }
    });
    return () => {
      stopped = true;
      appState.remove();
      disconnect();
    };
  }, [token, queryClient]);
}
