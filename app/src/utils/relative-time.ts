import type { TFunction } from 'i18next';

/** 인박스 시간 표시 — 오늘은 시각, 어제는 "어제", 그 전은 날짜(2026-10-16 사용자 결정: 요일("수")은 언제인지 헷갈려서 뺌) */
export function formatInboxTime(iso: string, locale: string, t: TFunction, now = new Date()): string {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday) return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (date.getTime() >= startOfToday - dayMs) return t('time.yesterday');
  return date.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
}
