import { describe, expect, it } from 'vitest';
import { DEFAULT_BANNED_WORDS, matchesBannedWord } from './default-banned-words.js';

describe('금칙어 비교(2026-10-20)', () => {
  it('띄어쓰기 언어는 단어 단위 — 다른 낱말 안에 든 건 안 막음', () => {
    expect(matchesBannedWord('you are a bitch', 'bitch', 'en')).toBe(true);
    expect(matchesBannedWord('Bitch!', 'bitch', 'en')).toBe(true);
    expect(matchesBannedWord('bitchy', 'bitch', 'en')).toBe(false);
    expect(matchesBannedWord('nueva computadora', 'puta', 'es')).toBe(false);
    expect(matchesBannedWord('eres una puta', 'puta', 'es')).toBe(true);
    expect(matchesBannedWord('add my line please', 'add my line', 'en')).toBe(true);
  });

  it('베트남어 성조 — 다른 글자는 안 막고, 조합형으로 저장돼도 잡음', () => {
    expect(matchesBannedWord('đồ ngu quá', 'đồ ngu', 'vi')).toBe(true);
    expect(matchesBannedWord('đồ ngủ đẹp', 'đồ ngu', 'vi')).toBe(false);
    expect(matchesBannedWord('đồ ngu'.normalize('NFD'), 'đồ ngu', 'vi')).toBe(true);
  });

  it('띄어쓰기 없는 언어는 포함되면 막음', () => {
    expect(matchesBannedWord('이 씨발 뭐야', '씨발', 'ko')).toBe(true);
    expect(matchesBannedWord('ไอ้เหี้ยนี่', 'เหี้ย', 'th')).toBe(true);
    expect(matchesBannedWord('お前死ねよ', '死ね', 'ja')).toBe(true);
  });

  it('기본 목록 — 9개 언어, 같은 언어 안에 겹치는 단어 없음, 흔한 멀쩡한 말을 막지 않음', () => {
    expect(Object.keys(DEFAULT_BANNED_WORDS).sort()).toEqual(['en', 'es', 'ja', 'ko', 'pt-BR', 'th', 'vi', 'zh-Hans', 'zh-Hant']);
    for (const terms of Object.values(DEFAULT_BANNED_WORDS)) expect(new Set(terms).size).toBe(terms.length);
    const innocent: [string, string][] = [
      ['ko', '시발점부터 다시 보지 마세요, 불이 꺼져도 오늘 존나 멋있어요'],
      ['th', 'แกงกะหรี่อร่อยมาก แม่งานเก่งจัง ควายน่ารัก'],
      ['en', 'what a classy pass, assassin cosplay, i love my cat pussycat'],
      ['es', 'mi computadora nueva, qué guapo'],
      ['vi', 'chúc ngủ ngon, đồ ngủ đẹp quá'],
    ];
    const all = Object.entries(DEFAULT_BANNED_WORDS).flatMap(([language, terms]) => terms.map((term) => ({ term, language })));
    for (const [, text] of innocent) {
      expect(all.filter((word) => matchesBannedWord(text, word.term, word.language)).map((word) => word.term)).toEqual([]);
    }
  });
});
