import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { ShutdownService } from './../src/common/lifecycle/shutdown.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    // main.ts와 같은 순서 — 켤 때 시작한 백그라운드 작업(결제 기록 채우기)이 끝난 뒤 DB 연결을 끊음
    await app.get(ShutdownService).drain(10_000);
    await app.close();
  });
});
