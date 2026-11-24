import { Module } from '@nestjs/common';
import { PrismaThrottlerStorage } from './prisma-throttler.storage.js';

/** ThrottlerModule.forRootAsync가 주입받을 DB 요청 제한 저장소(2026-11-24) */
@Module({ providers: [PrismaThrottlerStorage], exports: [PrismaThrottlerStorage] })
export class ThrottlerStoreModule {}
