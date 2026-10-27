import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';

// 만료·로그아웃된 지 30일 지난 로그인 세션은 지움(2026-10-27) — 그동안은 운영자가 "언제 끊겼나"를 볼 수 있게 남김
export const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthSessionCleanupService {
  private readonly logger = new Logger(AuthSessionCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 매일 새벽(태국 시간 04:40). 서버가 여러 대여도 deleteMany라 겹쳐 돌아도 안전
  @Cron('40 4 * * *', { timeZone: 'Asia/Bangkok' })
  async removeOldSessions(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - SESSION_RETENTION_MS);
    const { count } = await this.prisma.authSession.deleteMany({ where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] } });
    if (count > 0) this.logger.log(`지난 로그인 세션 ${count}개 삭제`);
    return count;
  }
}
