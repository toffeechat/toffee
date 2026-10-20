// 긴 메시지 전체보기(2026-10-19) — 말풍선의 "전체보기"가 열 내용을 잠깐 들고 있음(주소에 1,000자 글을 싣지 않으려고).
// 웹에서 전체보기 화면을 새로고침하면 비어 있음 → 화면이 "돌아가기"만 보여 줌

export interface FullMessage {
  text: string;
  /** 번역("번역 보기")에 필요 — 없으면 원문만 */
  actorId?: string;
  messageId?: string;
  welcome?: boolean;
  fanReply?: boolean;
  /** 위쪽에 보일 보낸 사람·시각 */
  senderName?: string;
  senderAvatar?: string | null;
  createdAt?: string;
}

let current: FullMessage | null = null;

export function setFullMessage(message: FullMessage): void {
  current = message;
}

export function getFullMessage(): FullMessage | null {
  return current;
}
