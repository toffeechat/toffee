import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../notifications/push.service.js';
import { pushStrings } from '../notifications/push-messages.js';
import { appError } from '../common/i18n/app-error.js';
import { bundleOpensAt, isReleased } from '../common/release/release.js';

export type ReleaseTarget = { actorId: string; bundleId?: never } | { bundleId: string; actorId?: never };

/**
 * 공개 예정·예약 오픈(2026-10-19). 방(아티스트·CP방)·묶음의 releaseAt 전엔 팬이 "알림 받기"만 누를 수 있고(ReleaseWatch),
 * 공개 시각이 지나면 1분마다 도는 작업이 알림 받기 팬에게 한 번 푸시. 알림 받기 줄은 공개 후에도 남겨서 "사전 신청 N명"(소속사에
 * 보여 줄 사전 수요 숫자)을 계속 볼 수 있게 함.
 */
@Injectable()
export class ReleaseService {
  private readonly logger = new Logger(ReleaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** 내가 알림 받기를 눌렀는지 — 팬 프로필·묶음 화면의 버튼 상태 */
  async status(userId: string, target: ReleaseTarget) {
    const watch = await this.prisma.releaseWatch.findFirst({ where: { userId, ...target }, select: { id: true } });
    return { watching: !!watch };
  }

  async watch(userId: string, target: ReleaseTarget) {
    const releaseAt = await this.releaseAtOf(target);
    // 이미 열렸으면 알림 받기 대신 바로 구독(앱은 공개되면 버튼이 구독으로 바뀜 — 화면을 오래 켜 둔 경우)
    if (isReleased(releaseAt)) throw new BadRequestException(appError('ALREADY_RELEASED'));
    const existing = await this.prisma.releaseWatch.findFirst({ where: { userId, ...target }, select: { id: true } });
    if (!existing) await this.prisma.releaseWatch.create({ data: { userId, ...target } });
    return { watching: true };
  }

  async unwatch(userId: string, target: ReleaseTarget) {
    await this.prisma.releaseWatch.deleteMany({ where: { userId, ...target } });
    return { watching: false };
  }

  /** 방별 알림 받기 수 — 운영자·소속사 화면 "알림 신청 N명" */
  async actorWatchCounts(actorIds: string[]): Promise<Map<string, number>> {
    if (actorIds.length === 0) return new Map();
    const groups = await this.prisma.releaseWatch.groupBy({ by: ['actorId'], where: { actorId: { in: actorIds } }, _count: { _all: true } });
    return new Map(groups.map((group) => [group.actorId!, group._count._all]));
  }

  async bundleWatchCounts(bundleIds: string[]): Promise<Map<string, number>> {
    if (bundleIds.length === 0) return new Map();
    const groups = await this.prisma.releaseWatch.groupBy({ by: ['bundleId'], where: { bundleId: { in: bundleIds } }, _count: { _all: true } });
    return new Map(groups.map((group) => [group.bundleId!, group._count._all]));
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() {
    const sent = await this.notifyDue().catch((error: unknown) => {
      this.logger.error(`공개 알림 실패: ${String(error)}`);
      return 0;
    });
    if (sent > 0) this.logger.log(`공개 알림 ${sent}건`);
  }

  /**
   * 공개 시각이 지났는데 아직 알리지 않은 방·묶음 → 알림 받기 팬에게 푸시. releaseNotifiedAt을 조건부 update로 먼저 잡아서
   * 서버가 여러 대여도 한 번만 보냄(푸시가 실패해도 다시 보내지 않음 — 중복 알림보다 한 번 놓치는 쪽이 나음). 보낸 방·묶음 수를 돌려줌.
   */
  async notifyDue(now = new Date()): Promise<number> {
    let sent = 0;
    const actors = await this.prisma.actor.findMany({
      where: { releaseAt: { lte: now }, releaseNotifiedAt: null },
      select: { id: true, releaseAt: true, legalName: true, retiredAt: true },
    });
    for (const actor of actors) {
      const claimed = await this.prisma.actor.updateMany({ where: { id: actor.id, releaseAt: actor.releaseAt, releaseNotifiedAt: null }, data: { releaseNotifiedAt: now } });
      if (claimed.count === 0 || actor.retiredAt) continue;
      const watchers = await this.prisma.releaseWatch.findMany({ where: { actorId: actor.id }, select: { userId: true } });
      // 구독 전 화면이라 공식 이름(둘러보기 카드와 같은 이름)
      await this.push.sendToUsers(
        watchers.map((watch) => watch.userId),
        (recipient) => ({ title: actor.legalName, body: pushStrings(recipient.locale).releasedBody }),
        { type: 'actor-released', actorId: actor.id },
      );
      sent += 1;
    }
    // 묶음 자체엔 공개 시각이 없고 든 방만 공개 전이던 경우도(알림 받기한 팬이 있으면) 같이 봄
    const bundles = await this.prisma.bundle.findMany({
      where: { releaseNotifiedAt: null, OR: [{ releaseAt: { lte: now } }, { releaseWatches: { some: {} } }] },
      select: { id: true, releaseAt: true, name: true, active: true, actors: { select: { actor: { select: { releaseAt: true } } } } },
    });
    for (const bundle of bundles) {
      // 든 방이 더 늦게 열리면 그때까지 기다림(묶음은 가장 늦은 공개 시각에 열림)
      if (!isReleased(bundleOpensAt(bundle.releaseAt, bundle.actors.map((item) => item.actor.releaseAt)), now)) continue;
      const claimed = await this.prisma.bundle.updateMany({ where: { id: bundle.id, releaseAt: bundle.releaseAt, releaseNotifiedAt: null }, data: { releaseNotifiedAt: now } });
      if (claimed.count === 0 || !bundle.active) continue;
      const watchers = await this.prisma.releaseWatch.findMany({ where: { bundleId: bundle.id }, select: { userId: true } });
      await this.push.sendToUsers(
        watchers.map((watch) => watch.userId),
        (recipient) => ({ title: bundle.name, body: pushStrings(recipient.locale).releasedBundleBody }),
        { type: 'bundle-released', bundleId: bundle.id },
      );
      sent += 1;
    }
    return sent;
  }

  private async releaseAtOf(target: ReleaseTarget): Promise<Date | null> {
    if (target.actorId) {
      const actor = await this.prisma.actor.findUnique({ where: { id: target.actorId }, select: { releaseAt: true } });
      if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
      return actor.releaseAt;
    }
    const bundle = await this.prisma.bundle.findUnique({ where: { id: target.bundleId }, select: { releaseAt: true, actors: { select: { actor: { select: { releaseAt: true } } } } } });
    if (!bundle) throw new NotFoundException(appError('BUNDLE_NOT_FOUND'));
    return bundleOpensAt(bundle.releaseAt, bundle.actors.map((item) => item.actor.releaseAt));
  }
}
