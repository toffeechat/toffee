import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller.js';
import { StoreNotificationsController } from './store-notifications.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { IapVerificationService } from './iap-verification.service.js';
import { StoreRenewalService } from './store-renewal.service.js';
import { RefundService } from './refund.service.js';
import { AdminRefundsController } from './admin-refunds.controller.js';
import { AdminStoreController } from './admin-store.controller.js';
import { SettlementsModule } from '../settlements/settlements.module.js';

@Module({
  imports: [SettlementsModule],
  controllers: [SubscriptionsController, StoreNotificationsController, AdminRefundsController, AdminStoreController],
  providers: [SubscriptionsService, IapVerificationService, RefundService, StoreRenewalService],
  exports: [RefundService],
})
export class SubscriptionsModule {}
