/**
 * 답장 글자 수(장기 구독 혜택, 2026-10-29) — 서버 backend/src/subscriptions/streak.ts의 countReplyChars와 같은 규칙:
 * 보이는 글자 하나를 1자로(태국어 모음·성조 기호, 폭 없는 문자, 이모지 변형·피부색·태그는 따로 안 셈). 둘이 다르면 앱은 된다는데 서버가 거절함.
 * 한도(100~500자)는 서버가 reply-quota의 maxLength로 알려 줌.
 */
let combiningMark: RegExp | null = null;
try {
  combiningMark = new RegExp('\\p{M}', 'u');
} catch {
  // 유니코드 속성(\p{M})을 모르는 엔진 — 결합 기호도 1자로 셈(서버보다 많게 세서 거절당하진 않음)
}

function notACharacter(char: string): boolean {
  const cp = char.codePointAt(0)!;
  return (
    !!combiningMark?.test(char) ||
    (cp >= 0x200b && cp <= 0x200d) ||
    cp === 0x2060 ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
    (cp >= 0xe0020 && cp <= 0xe007f)
  );
}

export function countReplyChars(text: string): number {
  let count = 0;
  for (const char of text) if (!notACharacter(char)) count += 1;
  return count;
}
