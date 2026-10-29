import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { withoutAutomationSignals, type ClientInfo } from './client-info.js';

export const ACCESS_LOG_RETENTION_DAYS = 90;
// 로그인이 유지된 채 쓰는 동안엔 한 시간에 한 번만 기록(User.lastActiveAt도 같은 주기)
export const VISIT_INTERVAL_MS = 60 * 60 * 1000;

export type AccessKind = 'LOGIN' | 'VISIT';

/** 접속 기록(2026-10-14) — 운영자 회원 관리의 "마지막 접속·접속 기록" */
@Injectable()
export class AccessLogService {
  private readonly logger = new Logger(AccessLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 로그인 성공 — 기록이 실패해도 로그인은 막지 않음 */
  async recordLogin(userId: string, method: string, client: ClientInfo): Promise<void> {
    try {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.accessLog.create({ data: { userId, kind: 'LOGIN', method, ...withoutAutomationSignals(client), createdAt: now } }),
        // 로그인 직후 첫 요청이 VISIT를 또 남기지 않게 마지막 접속도 같이 갱신
        this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now } }),
      ]);
    } catch (error) {
      this.logger.warn(`로그인 기록 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 인증된 요청마다 불림 — 마지막 접속이 한 시간 넘게 지났을 때만 lastActiveAt을 갱신하고 VISIT 한 줄.
   * 조건부 updateMany라 동시에 여러 요청이 와도 한 번만 기록됨. 응답을 기다리게 하지 않음.
   */
  touchVisit(userId: string, lastActiveAt: Date | null, client: ClientInfo): void {
    const now = new Date();
    if (lastActiveAt && now.getTime() - lastActiveAt.getTime() <= VISIT_INTERVAL_MS) return;
    const cutoff = new Date(now.getTime() - VISIT_INTERVAL_MS);
    void this.prisma.user
      .updateMany({
        where: { id: userId, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] },
        data: { lastActiveAt: now },
      })
      .then(({ count }) =>
        count ? this.prisma.accessLog.create({ data: { userId, kind: 'VISIT', ...withoutAutomationSignals(client), createdAt: now } }) : undefined,
      )
      .catch(() => {});
  }

  // 3개월 지난 기록은 매일 새벽 지움(태국 시간)
  @Cron('40 4 * * *', { timeZone: 'Asia/Bangkok' })
  async purgeOld(): Promise<number> {
    const before = new Date(Date.now() - ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.accessLog.deleteMany({ where: { createdAt: { lt: before } } });
    if (count) this.logger.log(`오래된 접속 기록 ${count}건 삭제`);
    return count;
  }
}
