import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * 중복 방지 키(2026-10-25) — 앱이 메시지 하나를 보낼 때 만든 값(보통 UUID). 응답이 끊겨 다시 보낼 땐 같은 값을 그대로 보냄.
 * 형식만 확인(영문·숫자·-·_ 8~64자) — 예전 앱은 안 보내므로 선택.
 */
export function ClientMessageIdField(): PropertyDecorator {
  return applyDecorators(IsOptional(), IsString(), Matches(/^[A-Za-z0-9_-]{8,64}$/));
}
