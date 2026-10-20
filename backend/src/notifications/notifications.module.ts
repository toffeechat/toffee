import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service.js';
import { EmailService } from './email.service.js';
import { IdleReminderService } from './idle-reminder.service.js';
import { AdminAlertService } from './admin-alert.service.js';

// 운영자 알림(AdminAlertService)은 신고·환불·문의 등 여러 모듈이 써서 전역(2026-10-20)
@Global()
@Module({
  providers: [PushService, EmailService, IdleReminderService, AdminAlertService],
  exports: [PushService, EmailService, AdminAlertService],
})
export class NotificationsModule {}
