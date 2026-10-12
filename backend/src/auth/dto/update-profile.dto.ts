import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

// 팬 프로필(2026-10-12) — 상태메시지(빈 문자열이면 지움), 사진은 업로드로 받은 키(null이면 기본 이미지). 보내지 않은 칸은 그대로
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  statusMessage?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  profileImageKey?: string | null;
}

export class CreateProfileImageUploadDto {
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

// 역할별 알림 설정(2026-10-12) — 보내지 않은 칸은 그대로
export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  notifyArtistMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyIdleAlerts?: boolean;
}
