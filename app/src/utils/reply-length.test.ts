import { describe, expect, it } from 'vitest';
import { countReplyChars } from './reply-length';

describe('답장 글자 수(서버와 같은 방법)', () => {
  it('보이는 글자 기준 — 태국어 결합 기호·이모지 변형·피부색은 따로 안 셈', () => {
    expect(countReplyChars('สวัสดีค่ะ')).toBe(6);
    expect(countReplyChars('안녕하세요')).toBe(5);
    expect(countReplyChars('hi ❤️')).toBe(4);
    expect(countReplyChars('👍🏽')).toBe(1);
  });
});
