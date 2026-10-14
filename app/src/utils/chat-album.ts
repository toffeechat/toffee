/**
 * 팬 채팅방 사진 묶음(2026-10-13) — 아티스트가 여러 장을 한 번에 보내면 메시지는 한 장씩 따로 저장되지만(환불 판단·답장 대상·신고는
 * 그대로 메시지 단위), 화면에선 같은 분에 연달아 온 글 없는 사진·영상을 카톡처럼 격자 한 칸으로 묶음.
 */
export interface AlbumCandidate {
  id: string;
  senderType: 'ARTIST' | 'FAN';
  mediaType: string;
  body: string | null;
  createdAt: string;
  extra?: string;
  replyTo?: unknown;
  sender?: { id: string } | null;
  retracted?: boolean;
}

export const MAX_ALBUM = 10;

const isAlbumable = (m: AlbumCandidate) =>
  m.senderType === 'ARTIST' && !m.extra && !m.retracted && !m.body && !m.replyTo && (m.mediaType === 'PHOTO' || m.mediaType === 'VIDEO');

/** 최신 → 오래된 순 목록에서 이어진 사진·영상을 묶음 줄 하나로(album은 시간순, 줄의 나머지 값은 가장 최근 것) */
export function groupAlbumRows<T extends AlbumCandidate>(messages: T[], sameMinute: (a: string, b: string) => boolean): (T & { album?: T[] })[] {
  const rows: (T & { album?: T[] })[] = [];
  let run: T[] = [];
  const flush = () => {
    if (run.length === 1) rows.push(run[0]);
    else if (run.length > 1) rows.push({ ...run[0], album: [...run].reverse() });
    run = [];
  };
  for (const message of messages) {
    const previous = run[run.length - 1];
    const joins =
      !!previous && isAlbumable(message) && run.length < MAX_ALBUM && message.sender?.id === previous.sender?.id && sameMinute(message.createdAt, previous.createdAt);
    if (!joins) flush();
    if (isAlbumable(message)) run.push(message);
    else rows.push(message);
  }
  flush();
  return rows;
}

/** 이 줄이 그 메시지를 담고 있는지(묶음이면 안의 메시지까지) — 알림·검색으로 이동, 읽음 줄 위치 */
export const rowHas = (row: { id: string; album?: { id: string }[] }, id: string | null | undefined) =>
  !!id && (row.id === id || !!row.album?.some((m) => m.id === id));

/** 격자 줄 나누기 — 2·3개는 한 줄, 4개는 2+2, 그 이상은 3개씩(끝에 1개만 남지 않게 2+2) */
export function albumLayout(count: number): number[] {
  if (count <= 3) return [count];
  if (count === 4) return [2, 2];
  const lines: number[] = [];
  let left = count;
  while (left > 4) {
    lines.push(3);
    left -= 3;
  }
  return left === 4 ? [...lines, 2, 2] : [...lines, left];
}
