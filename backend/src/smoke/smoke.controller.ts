import { Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { SmokeService } from './smoke.service.js';

@Controller('smoke')
export class SmokeController {
  constructor(private readonly smoke: SmokeService) {}

  // 배포 워크플로가 한 번 부름 — 비밀값 맞히기 시도를 막으려고 분당 5회
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('session')
  @HttpCode(HttpStatus.OK)
  session(@Headers('x-smoke-secret') secret: string | undefined) {
    return this.smoke.session(secret);
  }
}
