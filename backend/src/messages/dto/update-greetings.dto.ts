import { IsOptional, IsString, MaxLength } from 'class-validator';

// 환영·생일 축하 메시지(2026-10-12) — 빈 문자열이면 끔. 보내는 메시지와 같은 길이 제한
export class UpdateGreetingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  birthdayMessage?: string;
}
