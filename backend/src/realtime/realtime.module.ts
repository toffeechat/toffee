import { Global, Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeService } from './realtime.service.js';
import { DemoAccessModule } from '../demo/demo-access.module.js';

@Global()
@Module({
  imports: [DemoAccessModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
