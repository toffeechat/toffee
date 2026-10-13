import { IsString, Matches, MaxLength } from 'class-validator';

// 환영·생일 축하 메시지(2026-10-12) — 2026-10-13 사용자 결정으로 둘 다 필수(비어 있으면 아티스트가 메시지를 보내기 전에 먼저 쓰게 함).
// 보내는 메시지와 같은 길이 제한, 공백만은 안 됨
export class UpdateGreetingsDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  welcomeMessage!: string;

  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  birthdayMessage!: string;
}
