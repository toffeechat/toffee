import { Module } from '@nestjs/common';
import { ActorsController } from './actors.controller.js';
import { ActorsService } from './actors.service.js';
import { AgencyStatsService } from './agency-stats.service.js';
import { AgencyRecordsService } from './agency-records.service.js';
import { DailyStatsService } from './daily-stats.service.js';
import { ModerationModule } from '../moderation/moderation.module.js';

@Module({
  imports: [ModerationModule],
  controllers: [ActorsController],
  providers: [ActorsService, AgencyStatsService, AgencyRecordsService, DailyStatsService],
  exports: [ActorsService],
})
export class ActorsModule {}
