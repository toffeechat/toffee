/** 자동 번역 판단에 필요한 내 정보(`/auth/me`) */
export interface AutoTranslateMe {
  role: string;
  autoTranslate?: boolean;
  autoTranslateFanReplies?: boolean;
}

/**
 * 메시지 자동 번역(2026-10-16)을 할지. 팬 화면의 스타 메시지는 내 설정(기본 켜짐)만 보고, 아티스트·소속사 화면의 팬 답장은 서버 설정
 * `TRANSLATION_AUTO_FAN_REPLIES`(기본 꺼짐, 2026-10-19 — 답장 수만큼 비용이 쌓여서)까지 켜져 있어야. 내 정보를 받기 전엔 꺼짐
 */
export function shouldAutoTranslate(me: AutoTranslateMe | undefined, kind: 'artistMessage' | 'fanReply'): boolean {
  if (!me || me.autoTranslate === false) return false;
  return kind === 'artistMessage' || me.autoTranslateFanReplies === true;
}

/** 설정 > 언어에 "메시지 자동 번역" 스위치를 보일지 — 팬 답장 자동 번역이 꺼져 있으면 아티스트·소속사 계정엔 스위치가 하는 일이 없어서 숨김 */
export function showAutoTranslateSetting(me: AutoTranslateMe): boolean {
  if (me.role === 'ACTOR' || me.role === 'AGENCY_STAFF') return me.autoTranslateFanReplies === true;
  return true;
}
