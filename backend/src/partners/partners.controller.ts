import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { PartnersService } from './partners.service.js';

class AuthorizeDto {
  @IsString()
  @MaxLength(100)
  clientId: string;

  @IsString()
  @MaxLength(300)
  redirectUri: string;

  @IsString()
  @Length(8, 200)
  state: string;

  // PKCE S256 결과(base64url 43자)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  codeChallenge: string;
}

// 서비스 서버끼리 — 비밀값은 본문으로(로그에 남지 않게 주소 쿼리 금지)
class ClientAuthDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientSecret?: string;
}

class TokenDto extends ClientAuthDto {
  @IsString()
  @MaxLength(100)
  code: string;

  @Matches(/^[A-Za-z0-9._~-]{43,128}$/)
  codeVerifier: string;

  @IsString()
  @MaxLength(300)
  redirectUri: string;
}

class SubscriptionsDto extends ClientAuthDto {
  @IsString()
  @MaxLength(64)
  sub: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  artistIds: string[];
}

class RevokeDto extends ClientAuthDto {
  @IsString()
  @MaxLength(64)
  sub: string;
}

/** 디저트랩 다른 서비스(검볼) 토피 계정 연결 — partners.service.ts 설명 */
@Controller()
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get('partners/:clientId/preview')
  preview(@CurrentUser() user: AuthenticatedUser, @Param('clientId') clientId: string, @Query('redirectUri') redirectUri = '') {
    return this.partners.preview(user.id, clientId, redirectUri);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('partners/authorize')
  authorize(@CurrentUser() user: AuthenticatedUser, @Body() dto: AuthorizeDto) {
    return this.partners.authorize(user.id, dto);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('partners/token')
  token(@Body() dto: TokenDto) {
    return this.partners.token(dto);
  }

  // 검볼 예매 화면마다 부르므로 넉넉히(검볼 쪽에서 짧게 캐시함)
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post('partners/subscriptions')
  subscriptions(@Body() dto: SubscriptionsDto) {
    return this.partners.subscriptions(dto);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('partners/revoke')
  revokeFromPartner(@Body() dto: RevokeDto) {
    return this.partners.revokeFromPartner(dto);
  }

  @Get('me/partner-links')
  links(@CurrentUser() user: AuthenticatedUser) {
    return this.partners.myLinks(user.id);
  }

  @Delete('me/partner-links/:partner')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('partner') partner: string) {
    return this.partners.revoke(user.id, partner);
  }
}
