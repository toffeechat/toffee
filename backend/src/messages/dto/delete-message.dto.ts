import { IsOptional, IsString, MaxLength } from 'class-validator';

// 메시지 회수 — 운영자·소속사가 아티스트 메시지를 지울 땐 사유 필수(2026-10-25, 서비스에서 확인). 아티스트 본인·팬 회수는 안 받음
export class DeleteMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
