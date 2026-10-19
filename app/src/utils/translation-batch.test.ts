import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationMissingError, createTranslationBatcher, type SendTranslationBatch } from './translation-batch';

describe('말풍선 번역 묶기(자동 번역)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('같은 방·같은 언어 요청은 한 번에, 다른 언어는 따로 — 결과는 메시지마다 나눠 돌려줌', async () => {
    const calls: [string, string[], string][] = [];
    const send: SendTranslationBatch = async (actorId, ids, language) => {
      calls.push([actorId, ids, language]);
      return { translations: ids.filter((id) => id !== 'gone').map((id) => ({ messageId: id, text: `${language}:${id}` })) };
    };
    const load = createTranslationBatcher(send);
    const a = load('room', 'm1', 'ko');
    const b = load('room', 'm2', 'ko');
    const c = load('room', 'm1', 'ja');
    const missing = load('room', 'gone', 'ko').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(50);
    expect(calls).toEqual([
      ['room', ['m1', 'm2', 'gone'], 'ko'],
      ['room', ['m1'], 'ja'],
    ]);
    expect(await a).toEqual({ text: 'ko:m1' });
    expect(await b).toEqual({ text: 'ko:m2' });
    expect(await c).toEqual({ text: 'ja:m1' });
    expect(await missing).toBeInstanceOf(TranslationMissingError);
  });

  it('30개가 차면 기다리지 않고 바로 보냄, 요청이 실패하면 묶인 것 전부 실패', async () => {
    const sizes: number[] = [];
    const load = createTranslationBatcher(async (_actorId, ids) => {
      sizes.push(ids.length);
      throw new Error('down');
    });
    const results = Array.from({ length: 31 }, (_, i) => load('room', `m${i}`, 'ko').catch((error: Error) => error.message));
    expect(sizes).toEqual([30]);
    await vi.advanceTimersByTimeAsync(50);
    expect(sizes).toEqual([30, 1]);
    expect(new Set(await Promise.all(results))).toEqual(new Set(['down']));
  });
});
