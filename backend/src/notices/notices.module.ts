import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller.js';
import { NoticesService } from './notices.service.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({ imports: [TranslationModule], controllers: [NoticesController], providers: [NoticesService] })
export class NoticesModule {}
