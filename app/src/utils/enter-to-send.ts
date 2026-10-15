import { Platform, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';

type WebKeyEvent = TextInputKeyPressEventData & {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

/**
 * PC 웹 입력창에서 Enter = 보내기, Shift+Enter·Ctrl(⌘)+Enter = 줄바꿈(2026-10-15 사용자 요청, 카톡 PC·슬랙과 같게).
 * 한글 조합 중(IME)의 Enter는 글자 확정이라 보내지 않음 — 안 그러면 마지막 글자가 남거나 두 번 보내짐.
 * 폰 앱은 키보드의 줄바꿈 키를 그대로 씀(보내기는 버튼) — 웹이 아니면 아무것도 안 함.
 */
export function handleWebEnterKey(
  event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  options: { value: string; onChange: (next: string) => void; onSend: () => void },
): void {
  if (Platform.OS !== 'web') return;
  const key = event.nativeEvent as WebKeyEvent;
  if (key.key !== 'Enter' || key.isComposing || key.keyCode === 229 || key.altKey) return;
  if (key.shiftKey) return; // 브라우저가 그대로 줄바꿈
  event.preventDefault();
  if (key.ctrlKey || key.metaKey) {
    // Ctrl+Enter는 브라우저 기본 동작이 없어서 커서 자리에 직접 줄바꿈을 넣음
    const target = event.target as unknown as { selectionStart?: number | null; selectionEnd?: number | null } | null;
    const start = target?.selectionStart ?? options.value.length;
    const end = target?.selectionEnd ?? start;
    options.onChange(`${options.value.slice(0, start)}\n${options.value.slice(end)}`);
    return;
  }
  options.onSend();
}
