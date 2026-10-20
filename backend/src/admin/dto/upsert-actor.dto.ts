import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Max, Min, ValidateIf } from 'class-validator';
import { MAX_PRICE_CENTS, STORE_PRODUCT_ID_PATTERN } from '../../common/store/store-product.js';

export class CreateActorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chatDisplayName!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  monthlyPriceCents!: number;

  // 참조 ID라 @IsUUID 대신 @IsString — 존재 여부는 서비스에서 확인
  @IsOptional()
  @IsString()
  agencyId?: string;

  // 성별(2026-10-02) — 빼거나 null이면 지정 안 함(그룹·혼성 등)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(['FEMALE', 'MALE'])
  gender?: 'FEMALE' | 'MALE' | null;
}

// 커플방 만들기 — 멤버 배우 2명(참조 ID라 @IsString), 공식 이름, 방 이름(멤버 배우가 나중에 바꿀 수 있음), 월 가격
export class CreateCoupleDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  memberIds!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chatDisplayName!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  monthlyPriceCents!: number;
}

export class UpdateActorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chatDisplayName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_CENTS)
  monthlyPriceCents?: number;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  // 성별 — null이면 지정 안 함, 빼면 그대로. 커플방엔 못 넣음(서비스에서 확인)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(['FEMALE', 'MALE'])
  gender?: 'FEMALE' | 'MALE' | null;

  // 개인 구독 스토어 상품 ID — null이면 지움, 빼면 그대로
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(STORE_PRODUCT_ID_PATTERN)
  storeProductId?: string | null;

  // 공개 시각(ISO, 2026-10-19 예약 오픈) — null이면 바로 공개, 빼면 그대로. 운영자 화면은 태국 시간으로 입력
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  releaseAt?: string | null;
}

// 프로필 이미지 교체 — 값은 POST /admin/uploads로 받은 objectKey, null이면 삭제, 필드를 빼면 그대로
export class UpdateActorImagesDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  officialProfileImageKey?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  chatProfileImageKey?: string | null;
}

// 배우 본인 계정 연결 — null이면 연결 해제. ACTOR 역할 계정만 연결 가능
export class LinkActorUserDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  userId!: string | null;
}

// 배우 활동 종료(true)/재개(false)
export class SetRetiredDto {
  @IsBoolean()
  retired!: boolean;
}

// 활동 종료 예정(2026-10-20) — 미래 시각(ISO), null이면 예정 취소
export class SetRetireAtDto {
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  retireAt!: string | null;
}
