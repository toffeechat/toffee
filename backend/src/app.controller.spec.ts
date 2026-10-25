import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ShutdownService } from './common/lifecycle/shutdown.service.js';

describe('AppController', () => {
  let appController: AppController;
  const shutdown = { isDraining: false };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: () => Promise.resolve([1]) } },
        { provide: ShutdownService, useValue: shutdown },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  // 배포 때(SIGTERM 뒤 마무리 중) 준비 확인은 503 — 호스팅이 새 요청을 다른 서버로(2026-10-25)
  describe('health/ready', () => {
    it('평소엔 ok, 끄는 중이면 503', async () => {
      await expect(appController.getReady()).resolves.toEqual({ status: 'ok' });
      shutdown.isDraining = true;
      await expect(appController.getReady()).rejects.toThrow();
      shutdown.isDraining = false;
    });
  });
});
