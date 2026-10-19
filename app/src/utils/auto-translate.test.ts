import { describe, expect, it } from 'vitest';
import { shouldAutoTranslate, showAutoTranslateSetting } from './auto-translate';

describe('메시지 자동 번역 판단(2026-10-19)', () => {
  it('스타 메시지는 내 설정만 — 기본 켜짐, 끄면 꺼짐, 내 정보 전엔 꺼짐', () => {
    expect(shouldAutoTranslate({ role: 'USER', autoTranslate: true }, 'artistMessage')).toBe(true);
    expect(shouldAutoTranslate({ role: 'USER' }, 'artistMessage')).toBe(true);
    expect(shouldAutoTranslate({ role: 'USER', autoTranslate: false }, 'artistMessage')).toBe(false);
    expect(shouldAutoTranslate(undefined, 'artistMessage')).toBe(false);
  });

  it('팬 답장은 서버 설정까지 켜져 있어야 — 기본(값 없음)은 꺼짐', () => {
    expect(shouldAutoTranslate({ role: 'ACTOR', autoTranslate: true }, 'fanReply')).toBe(false);
    expect(shouldAutoTranslate({ role: 'ACTOR', autoTranslate: true, autoTranslateFanReplies: false }, 'fanReply')).toBe(false);
    expect(shouldAutoTranslate({ role: 'ACTOR', autoTranslate: true, autoTranslateFanReplies: true }, 'fanReply')).toBe(true);
    expect(shouldAutoTranslate({ role: 'ACTOR', autoTranslate: false, autoTranslateFanReplies: true }, 'fanReply')).toBe(false);
  });

  it('설정 스위치: 팬 답장 자동 번역이 꺼져 있으면 아티스트·소속사에겐 숨김, 팬·운영자는 항상', () => {
    expect(showAutoTranslateSetting({ role: 'ACTOR' })).toBe(false);
    expect(showAutoTranslateSetting({ role: 'AGENCY_STAFF', autoTranslateFanReplies: false })).toBe(false);
    expect(showAutoTranslateSetting({ role: 'AGENCY_STAFF', autoTranslateFanReplies: true })).toBe(true);
    expect(showAutoTranslateSetting({ role: 'USER' })).toBe(true);
    expect(showAutoTranslateSetting({ role: 'ADMIN' })).toBe(true);
  });
});
