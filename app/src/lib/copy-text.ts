import * as Clipboard from 'expo-clipboard';
import i18n from '@/i18n';

import { showToast } from '@/components/toast';

/** 말풍선 길게 누르기 → 복사(2026-10-14 아티스트·소속사 화면에도) — 끝나면 "복사했어요" */
export function copyText(text: string | null | undefined): void {
  if (!text) return;
  Clipboard.setStringAsync(text)
    .then(() => showToast(i18n.t('chat.copied')))
    .catch(() => showToast(i18n.t('chat.copyFailed')));
}
