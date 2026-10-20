import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { MAX_PRICE_CENTS } from '../../common/store/store-product.js';

// 아티스트 일괄 등록(2026-10-19) — 앱이 엑셀/CSV를 읽어 줄 단위로 보냄. 이름 길이·짝 확인은 서비스(planImport)가 줄별 오류로 돌려줌
export class ImportActorRowDto {
  @IsString()
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  chatDisplayName?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(['FEMALE', 'MALE'])
  gender?: 'FEMALE' | 'MALE' | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  partners?: string[];
}

export class ImportActorsDto {
  // 이번 표의 소속사(참조 ID라 @IsString) — 빼면 무소속
  @IsOptional()
  @IsString()
  agencyId?: string;

  // 개인방·CP방 월 구독료(나중에 아티스트 상세에서 하나씩 바꿀 수 있음)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  monthlyPriceCents!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  couplePriceCents!: number;

  // 공개 시각(ISO) — 이번에 만드는 아티스트·CP방 전부. 빼거나 null이면 바로 공개
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  releaseAt?: string | null;

  // true면 저장하지 않고 미리보기만
  @IsBoolean()
  dryRun!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ImportActorRowDto)
  rows!: ImportActorRowDto[];
}
