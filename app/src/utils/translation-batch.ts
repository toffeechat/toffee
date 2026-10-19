/** 한 번에 보내는 메시지 수 — 서버 TRANSLATE_BATCH_MAX와 같게 */
export const TRANSLATE_BATCH_MAX = 30;
/** 이 시간 동안 들어온 요청을 모아서 보냄 — 한 화면의 말풍선들은 거의 동시에 그려지므로 짧아도 충분 */
const WAIT_MS = 40;

export type SendTranslationBatch = (
  actorId: string,
  messageIds: string[],
  language: string,
) => Promise<{ translations: { messageId: string; text: string }[] }>;

/** 서버가 이 메시지는 번역하지 못함(엔진 실패·일부 누락) — 화면에선 그 말풍선에 "번역 보기" 버튼만 남김 */
export class TranslationMissingError extends Error {
  constructor() {
    super('translation missing');
  }
}

interface Waiter {
  messageId: string;
  resolve: (value: { text: string }) => void;
  reject: (error: unknown) => void;
}

/**
 * 말풍선 번역 묶기(2026-10-16 자동 번역) — 말풍선마다 따로 요청하는 대신, 잠깐(40ms) 사이에 같은 방·같은 언어로 들어온 요청을 모아 한 번에
 * (최대 30개, 넘으면 바로 보냄). 목록은 화면에 보이는 말풍선만 그리므로 결과적으로 "보이는 만큼씩" 번역됨.
 */
export function createTranslationBatcher(send: SendTranslationBatch) {
  const queues = new Map<string, { actorId: string; language: string; waiters: Waiter[]; timer: ReturnType<typeof setTimeout> | null }>();

  const flush = (key: string) => {
    const queue = queues.get(key);
    if (!queue) return;
    queues.delete(key);
    if (queue.timer) clearTimeout(queue.timer);
    const messageIds = [...new Set(queue.waiters.map((waiter) => waiter.messageId))];
    send(queue.actorId, messageIds, queue.language).then(
      (response) => {
        const texts = new Map(response.translations.map((row) => [row.messageId, row.text]));
        for (const waiter of queue.waiters) {
          const text = texts.get(waiter.messageId);
          if (text === undefined) waiter.reject(new TranslationMissingError());
          else waiter.resolve({ text });
        }
      },
      (error: unknown) => queue.waiters.forEach((waiter) => waiter.reject(error)),
    );
  };

  return (actorId: string, messageId: string, language: string) =>
    new Promise<{ text: string }>((resolve, reject) => {
      const key = `${actorId}\u0000${language}`;
      let queue = queues.get(key);
      if (!queue) {
        queue = { actorId, language, waiters: [], timer: null };
        queues.set(key, queue);
      }
      queue.waiters.push({ messageId, resolve, reject });
      if (queue.waiters.length >= TRANSLATE_BATCH_MAX) flush(key);
      else queue.timer ??= setTimeout(() => flush(key), WAIT_MS);
    });
}
