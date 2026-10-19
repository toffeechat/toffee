import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDemoCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agencyName!: string;

  // 비우면 서버가 읽기 쉬운 코드를 만들어 줌(예: gmk7-p3qa)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdateDemoCodeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agencyName?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  // true = 사용 중지(로그인 중인 사람도 로그아웃), false = 다시 사용
  @IsOptional()
  @IsBoolean()
  revoked?: boolean;
}
