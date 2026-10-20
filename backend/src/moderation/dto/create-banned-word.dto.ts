import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BANNED_WORD_LANGUAGES } from '../default-banned-words.js';

export class CreateBannedWordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  term!: string;

  // 앱 언어 9개(2026-10-20, 예전엔 ko/th/en) — 띄어쓰기 언어(en/es/pt-BR/vi)는 단어 단위로 비교
  @IsIn(BANNED_WORD_LANGUAGES)
  language!: string;
}

export class AddDefaultBannedWordsDto {
  // 빼면 모든 언어
  @IsOptional()
  @IsIn(BANNED_WORD_LANGUAGES)
  language?: string;
}

export class TestBannedWordsDto {
  @IsString()
  @MaxLength(2000)
  text!: string;
}
