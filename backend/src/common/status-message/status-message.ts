import { BadRequestException } from '@nestjs/common';
import { appError } from '../i18n/app-error.js';
import type { ModerationService } from '../../moderation/moderation.service.js';

// 상태메시지 최대 길이(2026-10-12 팬, 2026-10-25 아티스트 — 카톡 60자 참고)
export const STATUS_MESSAGE_MAX_LENGTH = 60;

/**
 * 팬·아티스트 상태메시지 공통 검사 — 공백 정리, 길이(글자 수), 보이지 않는 문자, 금칙어.
 * 빈 값이면 null(지우기)
 */
export async function cleanStatusMessage(raw: string, moderation: ModerationService): Promise<string | null> {
  const message = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if ([...message].length > STATUS_MESSAGE_MAX_LENGTH) {
    throw new BadRequestException(appError('STATUS_MESSAGE_TOO_LONG', { max: STATUS_MESSAGE_MAX_LENGTH }));
  }
  if (/[\p{Cc}\p{Cf}]/u.test(message)) throw new BadRequestException(appError('STATUS_MESSAGE_INAPPROPRIATE'));
  if (!message) return null;
  await moderation.assertNoBannedWords(message).catch(() => {
    throw new BadRequestException(appError('STATUS_MESSAGE_INAPPROPRIATE'));
  });
  return message;
}
