import { ApiError } from '@/lib/api-client';
import { UploadCancelledError } from '@/lib/upload-media';

/**
 * 메시지 보내기 다시 시도(2026-10-25) — 보낼 때마다 중복 방지 키(clientMessageId)를 붙여서, 서버는 저장했는데 응답이 끊긴 경우
 * 같은 키로 다시 보내도 한 번만 저장됨(서버가 처음 메시지를 돌려줌, 팬 답장 개수도 한 번만 셈). 그래서 연결이 끊겨 실패한
 * 보내기는 자동으로 몇 번 더 해 보고, 그래도 안 되면 화면에 "다시 보내기"를 보여 줌.
 */

/** 새 중복 방지 키 — 서버 형식(영문·숫자·-·_ 8~64자). 네이티브(Hermes)엔 crypto.randomUUID가 없을 수 있어서 대신 만듦 */
export function newClientMessageId(): string {
  const random = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  if (random) return random;
  let hex = '';
  for (let i = 0; i < 32; i += 1) hex += Math.floor(Math.random() * 16).toString(16);
  return `${Date.now().toString(36)}-${hex}`;
}

/**
 * 다시 보내 볼 만한 실패인지 — 연결 끊김(서버 응답 없음)·서버 오류(5xx)·잠깐 막힘(408·429)만. 금칙어·답장 한도·차단 같은
 * 거절(4xx)은 다시 보내도 같아서 아님. 보내기 취소도 아님.
 */
export function isRetryableSendError(error: unknown): boolean {
  if (error instanceof UploadCancelledError) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408 || error.status === 429;
  return true;
}

/** react-query 자동 재시도 — 다시 보내 볼 만한 실패만 2번 더(1초 → 2초) */
export const SEND_RETRY = {
  retry: (failureCount: number, error: unknown) => failureCount < 2 && isRetryableSendError(error),
  retryDelay: (attempt: number) => 1000 * 2 ** attempt,
} as const;

/**
 * 같은 내용을 다시 보낼 때 같은 키를 쓰게 기억해 두는 곳 — 화면을 나갔다 와도(앱이 켜져 있는 동안) 남음.
 * 보내기에 성공하거나 서버가 거절하면(다시 보내도 소용없음) 지움. 사진·영상은 이미 올린 파일 키도 같이 기억해서 다시 올리지 않음.
 */
export class PendingSends<Extra = undefined> {
  private readonly entries = new Map<string, { clientMessageId: string; extra?: Extra }>();

  /** 이 내용의 키 — 지난번에 못 보낸 같은 내용이면 그 키 그대로 */
  keyFor(signature: string): string {
    let entry = this.entries.get(signature);
    if (!entry) {
      entry = { clientMessageId: newClientMessageId() };
      this.entries.set(signature, entry);
    }
    return entry.clientMessageId;
  }

  extra(signature: string): Extra | undefined {
    return this.entries.get(signature)?.extra;
  }

  setExtra(signature: string, extra: Extra) {
    const entry = this.entries.get(signature);
    if (entry) entry.extra = extra;
  }

  /** 끝난 보내기 — 성공했거나, 다시 보내 봐야 소용없는 실패면 잊음(다음에 같은 글을 또 보내면 새 메시지) */
  settle(signature: string, error?: unknown) {
    if (error === undefined || !isRetryableSendError(error)) this.entries.delete(signature);
  }
}
