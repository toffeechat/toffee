import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import { loadPreference, savePreference } from '@/lib/preference-storage';

/**
 * 화면 모드 직접 설정(2026-10-12 사용자 요청) — "system"(기본, 기기 설정 따라가기) / "light" / "dark".
 * 화면은 hooks/use-color-scheme이 이 값을 먼저 보고, system이면 기기 설정을 씀. 앱(네이티브)은 Appearance에도 알려서
 * 키보드·알림창 같은 시스템 화면도 같은 모드로.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'toffee_theme_override';
let current: ThemePreference = 'system';
const listeners = new Set<() => void>();

function apply(next: ThemePreference) {
  current = next;
  if (Platform.OS !== 'web') Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  listeners.forEach((listener) => listener());
}

/** 앱 시작 때 한 번 — 저장해 둔 값 불러오기 */
export async function loadThemePreference(): Promise<void> {
  const stored = await loadPreference(KEY).catch(() => null);
  if (stored === 'light' || stored === 'dark') apply(stored);
}

export function setThemePreference(next: ThemePreference): void {
  apply(next);
  void savePreference(KEY, next === 'system' ? null : next);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
