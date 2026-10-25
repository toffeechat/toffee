import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ClientMessageIdField } from './client-message-id.js';

// 팬 답장은 텍스트만 — 사진/영상/음성은 아티스트→팬 방향에서만 허용
export class SendReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  // 같은 키로 다시 보내면 처음 저장한 답장을 돌려줌(답장 개수도 한 번만 셈)
  @ClientMessageIdField()
  clientMessageId?: string;
}
