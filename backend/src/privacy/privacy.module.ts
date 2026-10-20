import { Module } from '@nestjs/common';
import { AdminPrivacyController, PrivacyController } from './privacy.controller.js';
import { PrivacyExportService } from './privacy-export.service.js';

@Module({
  controllers: [PrivacyController, AdminPrivacyController],
  providers: [PrivacyExportService],
})
export class PrivacyModule {}
