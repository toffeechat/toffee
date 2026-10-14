import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlockDto {
  // 참조 ID라 @IsUUID 대신 @IsString
  @IsString()
  @IsNotEmpty()
  fanUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  // 차단 계기가 된 팬 답장(선택, 2026-10-13) — 소속사 "기록" 화면에서 다시 보여 줌
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  messageId?: string;
}
