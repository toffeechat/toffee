import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

// 환영·생일 축하 메시지(2026-10-12) — 2026-10-13 사용자 결정으로 둘 다 필수(2026-10-14부터 CP방은 환영만, 비어 있으면 아티스트가 메시지를 보내기 전에 먼저 쓰게 함).
// 보내는 메시지와 같은 길이 제한, 공백만은 안 됨
export class UpdateGreetingsDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  welcomeMessage!: string;

  // CP방은 생일 칸이 없어서 안 보냄(2026-10-14) — 개인방은 서버가 비어 있으면 거절(GreetingsService.updateSettings)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  birthdayMessage?: string;
}
