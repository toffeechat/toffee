import { describe, expect, it } from 'vitest';
import { detectScript, needsTranslation } from './detect-script';
import { IDLE_WARN_DAYS, idleDays } from './idle-days';
import { currentMonth, shiftMonth } from './month';
import { showNameToken } from './name-token';
import { STORE_PRODUCT_ID_PATTERN } from './store-product';
import { orderedProviders } from '@/components/social-button-style';
import { albumLayout, collapseRetracted, groupAlbumRows, rowHas } from './chat-album';
import { formatInboxTime } from './relative-time';

describe('번역 보기를 보여 줄지(글자 종류)', () => {
  it('글자 종류 판별', () => {
    expect(detectScript('오늘 촬영 끝!')).toBe('hangul');
    expect(detectScript('วันนี้ถ่ายละครเสร็จแล้ว')).toBe('thai');
    expect(detectScript('今日もありがとう！')).toBe('japanese');
    expect(detectScript('今天辛苦了')).toBe('han');
    expect(detectScript('See you tomorrow!')).toBe('latin');
    expect(detectScript('💛💛 !!')).toBeNull();
  });

  it('앱 언어와 다른 글자일 때만', () => {
    expect(needsTranslation('วันนี้ถ่ายละคร', 'ko')).toBe(true);
    expect(needsTranslation('오늘 촬영 끝', 'ko')).toBe(false);
    expect(needsTranslation('今天辛苦了', 'zh-Hant')).toBe(false);
    expect(needsTranslation('今日もありがとう', 'zh-Hans')).toBe(true);
    // 한국어 글에 영어 단어가 조금 섞여도 한글이 많으면 번역 안 띄움
    expect(needsTranslation('오늘 drama 촬영 끝났어', 'ko')).toBe(false);
    expect(needsTranslation('💛', 'en')).toBe(false);
    expect(needsTranslation(null, 'en')).toBe(false);
  });

  it('베트남어 — 베트남어에만 있는 글자로 영어와 구분', () => {
    expect(detectScript('Hôm nay quay phim xong rồi, nhớ mọi người lắm 💛')).toBe('vietnamese');
    expect(detectScript('Café au lait')).toBe('latin');
    expect(needsTranslation('Cảm ơn anh nhiều lắm!', 'en')).toBe(true);
    expect(needsTranslation('See you tomorrow!', 'vi')).toBe(true);
    expect(needsTranslation('Cảm ơn anh nhiều lắm!', 'vi')).toBe(false);
    expect(needsTranslation('오늘 촬영 끝', 'vi')).toBe(true);
    // 스페인어·포르투갈어는 같은 라틴 문자인 영어와 낱말·글자로 구분
    expect(needsTranslation('See you tomorrow!', 'es')).toBe(true);
    expect(needsTranslation('¡Muchas gracias por todo!', 'es')).toBe(false);
    expect(needsTranslation('See you tomorrow!', 'pt-BR')).toBe(true);
    expect(needsTranslation('Muito obrigada, você é demais!', 'pt-BR')).toBe(false);
    expect(needsTranslation('오늘 촬영 끝', 'pt-BR')).toBe(true);
    expect(needsTranslation('💛', 'es')).toBe(false);
  });
});

describe('미발송 일수', () => {
  it('며칠 전인지, 없으면 null', () => {
    const now = new Date('2026-09-29T12:00:00Z').getTime();
    expect(idleDays('2026-09-22T11:00:00Z', now)).toBe(IDLE_WARN_DAYS);
    expect(idleDays('2026-09-29T01:00:00Z', now)).toBe(0);
    expect(idleDays(null, now)).toBeNull();
  });
});

describe('정산 달', () => {
  it('태국 시간 기준 이번 달, 앞뒤 달(연도 넘김)', () => {
    expect(currentMonth(new Date('2026-09-30T17:30:00Z'))).toBe('2026-10');
    expect(currentMonth(new Date('2026-09-30T16:30:00Z'))).toBe('2026-09');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('기타', () => {
  it('아티스트·소속사 화면의 팬 이름 자리 표시', () => {
    expect(showNameToken('{{name}}야 안녕 {{name}}', '팬 닉네임')).toBe('〈팬 닉네임〉야 안녕 〈팬 닉네임〉');
  });

  it('스토어 상품 ID 형식(서버와 같은 규칙)', () => {
    expect(STORE_PRODUCT_ID_PATTERN.test('toffee.actor.nawin')).toBe(true);
    expect(STORE_PRODUCT_ID_PATTERN.test('Toffee-Actor')).toBe(false);
    expect(STORE_PRODUCT_ID_PATTERN.test('.toffee')).toBe(false);
  });

  it('로그인 버튼 순서(2026-10-02): 한국어면 카카오·네이버·구글·애플(LINE 숨김, 2026-10-12), 그 외엔 LINE·구글·애플만(키 있는 것만)', () => {
    expect(orderedProviders(['google', 'kakao', 'line', 'apple', 'naver'], 'ko')).toEqual(['kakao', 'naver', 'google', 'apple']);
    expect(orderedProviders(['google', 'kakao', 'line', 'apple', 'naver'], 'th')).toEqual(['line', 'google', 'apple']);
    expect(orderedProviders(['google', 'kakao'], 'ja')).toEqual(['google']);
  });
});

describe('채팅방 사진 묶음', () => {
  const minute = (a: string, b: string) => a.slice(0, 16) === b.slice(0, 16);
  const photo = (id: string, at: string, extra: Partial<{ body: string; sender: { id: string } }> = {}) => ({
    id, senderType: 'ARTIST' as const, mediaType: 'PHOTO', body: null as string | null, createdAt: at, sender: { id: 'a' }, ...extra,
  });
  it('같은 분에 연달아 온 글 없는 사진만 한 줄로(시간순), 글·다른 분은 따로', () => {
    // 최신 → 오래된 순
    const rows = groupAlbumRows(
      [photo('p4', '2026-10-13T10:01:00Z'), photo('p3', '2026-10-13T10:00:30Z'), photo('p2', '2026-10-13T10:00:20Z'), photo('p1', '2026-10-13T10:00:10Z', { body: '셀카' })],
      minute,
    );
    expect(rows.map((r) => r.album?.map((m) => m.id) ?? r.id)).toEqual(['p4', ['p2', 'p3'], 'p1']);
    expect(rowHas(rows[1], 'p2')).toBe(true);
    expect(rowHas(rows[1], 'p4')).toBe(false);
  });
  it('보낸 아티스트가 바뀌면(CP방) 나눔, 10장 넘으면 다음 묶음', () => {
    const rows = groupAlbumRows([photo('b', '2026-10-13T10:00:02Z', { sender: { id: 'b' } }), photo('a', '2026-10-13T10:00:01Z')], minute);
    expect(rows).toHaveLength(2);
    const many = Array.from({ length: 12 }, (_, i) => photo(`p${12 - i}`, `2026-10-13T10:00:${String(30 - i).padStart(2, '0')}Z`));
    expect(groupAlbumRows(many, minute).map((r) => r.album?.length ?? 1)).toEqual([10, 2]);
  });
  it('격자 줄 나누기', () => {
    expect([2, 3, 4, 5, 6, 7, 10].map(albumLayout)).toEqual([[2], [3], [2, 2], [3, 2], [3, 3], [3, 2, 2], [3, 3, 2, 2]]);
  });
});

describe('연달아 회수된 아티스트 메시지 한 줄로(사진 묶음 통째 회수)', () => {
  const sameMinute = (a: string, b: string) => a.slice(0, 16) === b.slice(0, 16);
  const m = (id: string, at: string, extra: Partial<{ retracted: boolean; senderType: 'ARTIST' | 'FAN' }> = {}) => ({
    id,
    senderType: 'ARTIST' as const,
    mediaType: 'PHOTO',
    body: null,
    createdAt: at,
    sender: { id: 'caramel' },
    ...extra,
  });
  it('같은 분에 연달아 회수된 건 가장 최근 것 하나만 남김', () => {
    const rows = [m('3', '2026-10-15T10:00:30Z', { retracted: true }), m('2', '2026-10-15T10:00:20Z', { retracted: true }), m('1', '2026-10-15T10:00:10Z', { retracted: true })];
    expect(collapseRetracted(rows, sameMinute).map((r) => r.id)).toEqual(['3']);
  });
  it('사이에 다른 메시지가 있거나 분이 다르면 따로', () => {
    const rows = [
      m('4', '2026-10-15T10:05:00Z', { retracted: true }),
      m('3', '2026-10-15T10:00:30Z', { retracted: true }),
      m('2', '2026-10-15T10:00:20Z'),
      m('1', '2026-10-15T10:00:10Z', { retracted: true }),
    ];
    expect(collapseRetracted(rows, sameMinute).map((r) => r.id)).toEqual(['4', '3', '2', '1']);
  });
});

describe('토피룸 목록 시간(2026-10-16 — 요일 없이)', () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof formatInboxTime>[2];
  const now = new Date(2026, 9, 16, 15, 0);
  it('오늘은 시각, 어제는 "어제", 그 전은 날짜', () => {
    expect(formatInboxTime(new Date(2026, 9, 16, 9, 5).toISOString(), 'en-US', t, now)).toBe('9:05 AM');
    expect(formatInboxTime(new Date(2026, 9, 15, 23, 0).toISOString(), 'en-US', t, now)).toBe('time.yesterday');
    expect(formatInboxTime(new Date(2026, 9, 14, 12, 0).toISOString(), 'en-US', t, now)).toBe('10/14');
  });
});
