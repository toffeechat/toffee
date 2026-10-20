import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  // 올리면서(또는 고치면서) 모두에게 푸시(2026-10-20) — 한 공지에 한 번만
  @IsOptional()
  @IsBoolean()
  push?: boolean;
}
