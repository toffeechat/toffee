import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SmokeModule } from './smoke/smoke.module.js';
import { AppSettingsModule } from './app-settings/app-settings.module.js';
import { SupportModule } from './support/support.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { MaintenanceGuard } from './app-settings/maintenance.guard.js';
import { SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { StoriesModule } from './stories/stories.module.js';
import { ActorsModule } from './actors/actors.module.js';
import { AgenciesModule } from './agencies/agencies.module.js';
import { StorageModule } from './storage/storage.module.js';
import { BlocksModule } from './blocks/blocks.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { SettlementsModule } from './settlements/settlements.module.js';
import { TranslationModule } from './translation/translation.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ParentalConsentModule } from './parental-consent/parental-consent.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard.js';
import { LocalizedExceptionFilter } from './common/filters/localized-exception.filter.js';
import { AuditModule } from './audit/audit.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { BundlesModule } from './bundles/bundles.module.js';
import { LegalModule } from './legal/legal.module.js';
import { DemoModule } from './demo/demo.module.js';
import { NoticesModule } from './notices/notices.module.js';
import { ReleasesModule } from './releases/releases.module.js';
import { LifecycleModule } from './common/lifecycle/shutdown.service.js';

@Module({
  imports: [
    AppSettingsModule,
    SupportModule,
    PrivacyModule,
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(),
    // 배포 때 처리 중인 요청·푸시·cron을 끝내고 끄기(2026-10-25, main.ts)
    LifecycleModule,
    PrismaModule,
    RealtimeModule,
    AuditModule,
    StorageModule,
    AuthModule,
    NotificationsModule,
    ReportsModule,
    MessagesModule,
    StoriesModule,
    ActorsModule,
    AgenciesModule,
    BlocksModule,
    SubscriptionsModule,
    SettlementsModule,
    TranslationModule,
    BundlesModule,
    ReleasesModule,
    LegalModule,
    DemoModule,
    SmokeModule,
    NoticesModule,
    ModerationModule,
    AdminModule,
    ParentalConsentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 순서 중요: 스로틀링 → JWT 인증(@Public() 이면 통과) → 역할 검사
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // 점검 모드(2026-10-20) — 로그인 확인 뒤에 돌아서 운영자는 통과
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    // 오류 문구를 요청 언어로 번역 + 처리 안 된 예외(5xx)만 Sentry로 보냄(SentryGlobalFilter 확장)
    { provide: APP_FILTER, useClass: LocalizedExceptionFilter },
  ],
})
export class AppModule {}
