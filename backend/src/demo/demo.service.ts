import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { seedDemo } from './demo-seed.js';
import { isDemoServer } from './demo-mode.js';
import { DemoAccessService } from './demo-access.service.js';

/**
 * 운영자 화면 "데모 초기화"(2026-10-01) — 데모 서버(DEMO_SEED가 있고 production이 아님)에서만 켜짐.
 * Railway 변수로 reset → true를 두 번 배포하던 걸 버튼 하나로. 데이터를 전부 지우는 기능이라 운영 서버에선 라우트도 404.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly demoAccess: DemoAccessService,
  ) {}

  isEnabled(): boolean {
    return isDemoServer(this.configService.get<string>('DEMO_SEED')?.trim(), this.configService.get<string>('NODE_ENV'));
  }

  async reset(): Promise<void> {
    if (!this.isEnabled()) throw new NotFoundException();
    // 한 트랜잭션으로 — 중간에 실패하면 지운 것도 되돌아감. 쿼리가 많아 기본 5초보다 넉넉히
    await this.prisma.$transaction((tx) => seedDemo(tx), { timeout: 60_000, maxWait: 10_000 });
    this.logger.log('운영자 화면에서 데모 데이터를 초기화함');
  }

  /**
   * 매일 새벽 자동 초기화(2026-10-19 사용자 결정) — 소속사가 바꿔 놓은 내용·다른 소속사의 흔적을 지우고 통계용 기록도 오늘 기준으로.
   * DEMO_DAILY_RESET=true인 데모 서버에서만. 최근 30분 안에 데모 입장 코드로 쓰던 사람이 있으면 화면이 꼬이지 않게 그날은 건너뜀.
   * 입장 코드·데모 접속 기록은 지우지 않음(demo-seed가 건드리지 않는 표). 태국 새벽 4시 = 한국 6시.
   */
  @Cron('0 4 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyReset(): Promise<'reset' | 'skipped' | 'off'> {
    if (!this.isEnabled() || this.configService.get<string>('DEMO_DAILY_RESET')?.trim() !== 'true') return 'off';
    if (await this.demoAccess.recentlyActive()) {
      this.logger.log('데모 자동 초기화 건너뜀 — 최근 30분 안에 접속한 사람이 있음');
      return 'skipped';
    }
    await this.prisma.$transaction((tx) => seedDemo(tx), { timeout: 60_000, maxWait: 10_000 });
    this.logger.log('데모 데이터 자동 초기화(매일 새벽)');
    return 'reset';
  }
}
