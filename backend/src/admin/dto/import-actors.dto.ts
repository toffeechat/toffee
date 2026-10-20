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

// CP방 멤버 하나 — 이번 표의 줄 번호(row) 또는 이미 등록된 아티스트 id 중 하나
export class ImportCoupleMemberDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(299)
  row?: number;

  @IsOptional()
  @IsString()
  actorId?: string;
}

export class ImportCoupleDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ImportCoupleMemberDto)
  members!: ImportCoupleMemberDto[];
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

  // 새 아티스트 줄 — 이미 등록된 두 사람으로 CP방만 만들 땐 비어도 됨(그땐 couples가 있어야 함, 서비스가 확인)
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ImportActorRowDto)
  rows!: ImportActorRowDto[];

  // 화면에서 멤버를 직접 고른 CP방(2026-10-20) — 엑셀의 "CP 짝"(이름)과 같이 써도 됨
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => ImportCoupleDto)
  couples?: ImportCoupleDto[];
}
