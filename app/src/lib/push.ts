// 웹용(푸시 없음) — 실제 구현은 push.native.ts. 두 파일의 내보내는 모양을 똑같이 유지할 것.
// 웹 푸시(브라우저 알림)는 1차 범위 밖.

export interface PushData {
  type?: string;
  actorId?: string;
  /** 묶음 공개 알림(2026-10-19) */
  bundleId?: string;
  messageId?: string;
  /** 공지 푸시·운영자 알림 종류·문의 답변(2026-10-20) */
  noticeId?: string;
  kind?: string;
  inquiryId?: string;
  title?: string;
  body?: string;
  /** 보낸 사람 사진(서버가 대화 알림용으로 넣음, 2026-10-13) — 앱 사용 중 배너에도(2026-10-14) */
  senderImage?: string;
  senderName?: string;
}

export async function registerThisDevice(): Promise<void> {}

export async function unregisterThisDevice(): Promise<void> {}

export function subscribeTokenRefresh(): () => void {
  return () => {};
}

export function subscribeNotificationOpens(_onOpen: (data: PushData) => void): () => void {
  return () => {};
}

export function subscribeForegroundMessages(_onMessage: (data: PushData) => void): () => void {
  return () => {};
}

export function setAppBadgeCount(_count: number): void {}
