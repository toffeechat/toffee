import { IsString, MaxLength } from 'class-validator';

// 상태메시지(2026-10-25) — 빈 문자열이면 지움. 세부 규칙(60자·보이지 않는 문자·금칙어)은 cleanStatusMessage에서, 여기선 터무니없이 긴 입력만
export class UpdateActorStatusMessageDto {
  @IsString()
  @MaxLength(200)
  statusMessage!: string;
}
