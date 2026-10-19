import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DemoAccessController } from './demo-access.controller.js';
import { DemoAccessService } from './demo-access.service.js';

// 소속사별 데모 입장 코드(2026-10-19) — 로그인·요청 확인(AuthModule)과 자동 초기화(DemoModule)가 같이 씀
@Module({
  imports: [NotificationsModule],
  controllers: [DemoAccessController],
  providers: [DemoAccessService],
  exports: [DemoAccessService],
})
export class DemoAccessModule {}
