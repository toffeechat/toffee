import { describe, expect, it } from 'vitest';
import { clipLongMessage, LONG_MESSAGE_CHARS, LONG_MESSAGE_LINES } from './long-message';

describe('긴 메시지 자르기', () => {
  it('500자·15줄 이하면 그대로', () => {
    const text = 'a'.repeat(LONG_MESSAGE_CHARS);
    expect(clipLongMessage(text)).toEqual({ text, clipped: false });
    const lines = Array.from({ length: LONG_MESSAGE_LINES }, () => 'hi').join('\n');
    expect(clipLongMessage(lines).clipped).toBe(false);
  });

  it('글자 수가 넘으면 앞부분 + …, 단어 중간에서 안 끊음', () => {
    const result = clipLongMessage('hello world '.repeat(60));
    expect(result.clipped).toBe(true);
    expect(result.text.endsWith('world…') || result.text.endsWith('hello…')).toBe(true);
    expect([...result.text].length).toBeLessThanOrEqual(401);
  });

  it('줄 수가 넘으면(짧은 줄을 길게 늘어놓은 글) 앞 12줄만', () => {
    const text = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = clipLongMessage(text);
    expect(result.clipped).toBe(true);
    expect(result.text.split('\n')).toHaveLength(12);
    expect(result.text.endsWith('line 12…')).toBe(true);
  });

  it('태국어(띄어쓰기 드묾)도 글자 기준으로', () => {
    const result = clipLongMessage('สวัสดีค่ะ'.repeat(80));
    expect(result.clipped).toBe(true);
    expect([...result.text].length).toBe(401);
  });
});
