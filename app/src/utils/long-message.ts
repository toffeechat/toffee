// 긴 메시지 전체보기(2026-10-19 사용자 결정, 카톡 방식) — 글자 수나 줄 수가 기준을 넘으면 말풍선엔 앞부분만 + "… 전체보기",
// 누르면 전체 화면(app/message.tsx). 메시지는 최대 1,000자라 말풍선에서 다 펼치면 화면 서너 장을 넘겨야 해서.
// 기준값은 여기 한 곳(바꾸기 쉽게).
export const LONG_MESSAGE_CHARS = 500;
export const LONG_MESSAGE_LINES = 15;
// 잘라서 보여 줄 앞부분 — 기준보다 조금 짧게(잘린 게 바로 보이게)
const PREVIEW_CHARS = 400;
const PREVIEW_LINES = 12;

export function clipLongMessage(text: string): { text: string; clipped: boolean } {
  const lines = text.split('\n');
  // 글자 수는 이모지·태국어 결합 문자도 한 글자로 보이게 코드 포인트 기준
  const chars = [...text];
  if (chars.length <= LONG_MESSAGE_CHARS && lines.length <= LONG_MESSAGE_LINES) return { text, clipped: false };
  let preview = lines.slice(0, PREVIEW_LINES).join('\n');
  const previewChars = [...preview];
  if (previewChars.length > PREVIEW_CHARS) {
    preview = previewChars.slice(0, PREVIEW_CHARS).join('');
    // 단어 중간에서 끊기지 않게 — 끝 40자 안에 띄어쓰기가 있으면 거기서(태국어처럼 띄어쓰기가 드문 글은 그대로)
    const space = preview.search(/\s\S*$/);
    if (space > PREVIEW_CHARS - 40) preview = preview.slice(0, space);
  }
  return { text: `${preview.trimEnd()}…`, clipped: true };
}
