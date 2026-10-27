import { IsInt, IsOptional, Matches, Max, Min, ValidateIf } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// 소속사 배분율 이력 한 줄(2026-10-27) — fromMonth(태국 시간 YYYY-MM)부터 percent, null이면 기본값(AGENCY_REVENUE_SHARE_PERCENT)
export class SetShareRateDto {
  @Matches(MONTH)
  fromMonth!: string;

  @ValidateIf((dto: SetShareRateDto) => dto.percent !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  percent!: number | null;
}

// 창립 파트너 — fromMonth부터 months개월 foundingPercent, 그 뒤 afterPercent(null = 기본값). 기본은 12개월 70% → 기본(60%)
export class FoundingShareDto {
  @Matches(MONTH)
  fromMonth!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  foundingPercent?: number;

  @IsOptional()
  @ValidateIf((dto: FoundingShareDto) => dto.afterPercent !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  afterPercent?: number | null;
}
