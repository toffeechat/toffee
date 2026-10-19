import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { TRANSLATE_BATCH_MAX, TranslationService } from './translation.service.js';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../common/i18n/locales.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

class TranslateMessageDto {
  @IsIn(SUPPORTED_LOCALES)
  targetLanguage!: SupportedLocale;
}

// 묶음 번역(2026-10-16 자동 번역) — 화면에 보이는 말풍선 여러 개
class TranslateMessagesDto extends TranslateMessageDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TRANSLATE_BATCH_MAX)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  messageIds!: string[];
}

@Controller('actors/:actorId/messages')
export class TranslationController {
  constructor(private readonly translation: TranslationService) {}

  // 번역 버튼 — 비용이 드는 호출이라 사람당 1분에 30번까지
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('extras/welcome/translate')
  @HttpCode(HttpStatus.OK)
  translateWelcome(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Body() dto: TranslateMessageDto) {
    return this.translation.translateWelcome(user.id, actorId, dto.targetLanguage);
  }

  // 자동 번역 — 스크롤하며 화면에 새로 보이는 말풍선마다 한 번씩이라 한 개짜리보다 넉넉하게(한 번에 최대 30개)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('extras/translate')
  @HttpCode(HttpStatus.OK)
  translateMany(@CurrentUser() user: AuthenticatedUser, @Param('actorId') actorId: string, @Body() dto: TranslateMessagesDto) {
    return this.translation.translateMany(user.id, actorId, dto.messageIds, dto.targetLanguage);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':messageId/translate')
  @HttpCode(HttpStatus.OK)
  translate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('actorId') actorId: string,
    @Param('messageId') messageId: string,
    @Body() dto: TranslateMessageDto,
  ) {
    return this.translation.translateMessage(user.id, actorId, messageId, dto.targetLanguage);
  }
}
