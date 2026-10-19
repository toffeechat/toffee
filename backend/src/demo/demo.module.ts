import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller.js';
import { DemoAccessModule } from './demo-access.module.js';
import { DemoService } from './demo.service.js';

@Module({
  imports: [DemoAccessModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
