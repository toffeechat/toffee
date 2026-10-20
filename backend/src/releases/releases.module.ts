import { Global, Module } from '@nestjs/common';
import { ReleasesController } from './releases.controller.js';
import { ReleaseService } from './release.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

// 운영자·소속사 화면(알림 신청 수)에서도 ReleaseService를 써서 전역으로
@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [ReleasesController],
  providers: [ReleaseService],
  exports: [ReleaseService],
})
export class ReleasesModule {}
