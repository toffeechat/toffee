import { describe, expect, it, vi } from 'vitest';

// api-client·upload-media는 네이티브 모듈을 불러서 오류 종류만 가짜로
vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/lib/upload-media', () => ({ UploadCancelledError: class UploadCancelledError extends Error {} }));

const { ApiError } = await import('@/lib/api-client');
const { UploadCancelledError } = await import('@/lib/upload-media');
const { PENDING_SEND_TTL_MS, PendingSends, SEND_RETRY, isRetryableSendError, newClientMessageId } = await import('./send-retry');

describe('메시지 다시 보내기(2026-10-25)', () => {
  it('키는 서버 형식(영문·숫자·-·_ 8~64자)이고 매번 다름', () => {
    const keys = new Set(Array.from({ length: 50 }, newClientMessageId));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('crypto.randomUUID가 없어도(네이티브) 만들 수 있음', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      expect(newClientMessageId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });

  it('연결 끊김·서버 오류만 다시 보냄 — 금칙어·한도 같은 거절과 보내기 취소는 아님', () => {
    expect(isRetryableSendError(new TypeError('Network request failed'))).toBe(true);
    expect(isRetryableSendError(new ApiError(502, 'bad gateway'))).toBe(true);
    expect(isRetryableSendError(new ApiError(429, 'slow down'))).toBe(true);
    expect(isRetryableSendError(new ApiError(400, 'REPLY_LIMIT'))).toBe(false);
    expect(isRetryableSendError(new ApiError(403, 'REPLY_BLOCKED'))).toBe(false);
    expect(isRetryableSendError(new UploadCancelledError('cancelled'))).toBe(false);
  });

  it('자동 재시도는 다시 보낼 만한 실패만 2번까지', () => {
    expect(SEND_RETRY.retry(0, new TypeError('offline'))).toBe(true);
    expect(SEND_RETRY.retry(1, new TypeError('offline'))).toBe(true);
    expect(SEND_RETRY.retry(2, new TypeError('offline'))).toBe(false);
    expect(SEND_RETRY.retry(0, new ApiError(400, 'bad'))).toBe(false);
  });

  it('못 보낸 같은 내용은 같은 키, 보내고 나면(또는 거절되면) 다음엔 새 키', () => {
    const pending = new PendingSends<{ mediaKey: string }>();
    const first = pending.keyFor('a|안녕');
    // 연결이 끊겨 실패 → 다시 보내기는 같은 키(서버가 이미 저장했으면 그걸 돌려줌)
    pending.settle('a|안녕', new TypeError('offline'));
    expect(pending.keyFor('a|안녕')).toBe(first);
    // 다른 내용은 다른 키
    expect(pending.keyFor('a|다른 글')).not.toBe(first);
    // 성공 → 같은 글을 또 보내면 새 메시지
    pending.settle('a|안녕');
    expect(pending.keyFor('a|안녕')).not.toBe(first);
    // 서버가 거절(한도 등) → 잊음
    const rejected = pending.keyFor('a|한도');
    pending.settle('a|한도', new ApiError(400, 'REPLY_LIMIT'));
    expect(pending.keyFor('a|한도')).not.toBe(rejected);
  });

  it('이미 올린 파일 키를 기억해서 다시 보낼 땐 다시 올리지 않게', () => {
    const pending = new PendingSends<{ mediaKey: string }>();
    pending.keyFor('photo-1');
    pending.setExtra('photo-1', { mediaKey: 'actors/a/message/x.jpg' });
    pending.settle('photo-1', new TypeError('offline'));
    expect(pending.extra('photo-1')).toEqual({ mediaKey: 'actors/a/message/x.jpg' });
    pending.settle('photo-1');
    expect(pending.extra('photo-1')).toBeUndefined();
  });

  it('못 보낸 키도 10분이 지나면 잊음 — 다음 날 같은 글은 새 메시지(2026-10-28)', () => {
    vi.useFakeTimers();
    try {
      const pending = new PendingSends<{ mediaKey: string }>();
      const first = pending.keyFor('a|안녕');
      pending.setExtra('a|안녕', { mediaKey: 'x' });
      pending.settle('a|안녕', new TypeError('offline'));
      vi.advanceTimersByTime(PENDING_SEND_TTL_MS - 1000);
      expect(pending.keyFor('a|안녕')).toBe(first);
      vi.advanceTimersByTime(2000);
      expect(pending.extra('a|안녕')).toBeUndefined();
      expect(pending.keyFor('a|안녕')).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});
