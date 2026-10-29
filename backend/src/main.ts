import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { checkEnv } from './common/config/env-check.js';
import { ShutdownService } from './common/lifecycle/shutdown.service.js';
import { RealtimeService } from './realtime/realtime.service.js';

async function bootstrap() {
  // 빠진 설정값은 켜자마자 알림 — 치명적이면 여기서 멈춤(호스팅 로그에 이유가 남음)
  const logger = new Logger('Startup');
  const { errors, warnings } = checkEnv(process.env);
  warnings.forEach((warning) => logger.warn(warning));
  if (errors.length) {
    errors.forEach((error) => logger.error(error));
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 호스팅 프록시(로드밸런서) 뒤에서 실제 접속 IP를 읽도록 — 로그인 요청 횟수 제한이 IP 기준이라, 안 하면 모든 사람이
  // 프록시 IP 하나로 보여 서로의 한도를 나눠 씀. 값은 프록시 단계 수(보통 1). "true"는 1로 봄 — Express의 true는 X-Forwarded-For 맨 왼쪽
  // (접속하는 쪽이 마음대로 적는 값)을 IP로 믿어서 요청 제한을 피하고 접속 기록 IP를 위조할 수 있었음(2026-10-28 점검)
  // 앞뒤 공백은 지움(2026-10-28 — env-check는 지우고 봐서 "1 "이면 경고 없이 프록시 신뢰가 꺼졌음)
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? 1 : false);
  // 배포·재시작 때(SIGTERM) 하던 일을 끝내고 끔 — enableShutdownHooks()는 DB 연결을 먼저 끊어서 처리 중인 요청·푸시·cron이
  // 중간에 실패했음(2026-10-25). 순서는 ShutdownService 설명 참고
  const shutdown = app.get(ShutdownService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 실시간 연결(SSE)은 계속 열려 있는 요청이라 따로 닫음(RealtimeService.closeStreams)
    if (req.path === '/realtime') return next();
    // 끄는 중엔 응답 후 연결을 닫아서 앱의 다음 요청이 새 서버로 가게
    if (shutdown.isDraining) res.setHeader('Connection', 'close');
    const done = shutdown.requestStarted();
    res.on('finish', done);
    res.on('close', done);
    next();
  });
  const graceMs = Number(process.env.SHUTDOWN_GRACE_MS) || 25_000;
  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) {
      logger.warn(`${signal} 다시 받음 — 바로 종료`);
      process.exit(1);
    }
    stopping = true;
    logger.log(`${signal} — 처리 중인 일을 마치고 종료(최대 ${graceMs}ms)`);
    // 그래도 안 꺼지면 강제로(호스팅이 SIGKILL 하기 전에 로그라도 남게)
    setTimeout(() => {
      logger.error('종료가 너무 오래 걸려 강제 종료');
      process.exit(1);
    }, graceMs + 5_000).unref();
    shutdown.beginDrain();
    app.get(RealtimeService).closeStreams();
    await shutdown.drain(graceMs);
    await app.close().catch((error: unknown) => logger.error(`종료 중 오류: ${String(error)}`));
    process.exit(0);
  };
  process.on('SIGTERM', (signal) => void stop(signal));
  process.on('SIGINT', (signal) => void stop(signal));
  // whitelist + forbidNonWhitelisted: DTO에 없는 필드가 오면 요청 자체를 거부
  // (예: 로그인 바디에 role 같은 필드를 몰래 끼워 보내는 걸 막음)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // 인증은 쿠키가 아니라 Authorization 헤더의 Bearer 토큰이라 CSRF 노출이 없음 —
  // 앱은 Expo Web(react-native-web)도 지원하므로 브라우저에서 오는 요청을 막지 않음
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
