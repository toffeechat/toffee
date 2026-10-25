import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SmokeController } from './smoke.controller.js';
import { SmokeService } from './smoke.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SmokeController],
  providers: [SmokeService],
})
export class SmokeModule {}
