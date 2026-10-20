import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MediaService } from '../storage/media.service.js';
import { ActorKind, Role } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 아티스트 계정 연결 링크(2026-10-19) — 아이디·비밀번호를 만들어 주지 않고, 운영자가 만든 1회용 링크를 아티스트가 열어 본인 소셜 계정을
 * 붙임(예전: 가입 → 운영자가 역할 변경 → 아티스트 화면에서 계정 지정 3단계). 원문 토큰은 만들 때 한 번만 돌려주고 DB엔 해시만.
 * 유효 기간은 ACTOR_LINK_TTL_DAYS(잠정 14일, STATUS 정책 표). 다시 만들면 예전 링크는 바로 무효.
 */
@Injectable()
export class ActorLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  private get ttlDays(): number {
    return Number(process.env.ACTOR_LINK_TTL_DAYS) || 14;
  }

  /** 링크 만들기(여러 명 한꺼번에) — 본인 계정이 이미 연결된 아티스트·CP방은 건너뜀 */
  async issue(adminId: string, actorIds: string[]) {
    const actors = await this.prisma.actor.findMany({
      where: { id: { in: [...new Set(actorIds)] } },
      select: { id: true, legalName: true, kind: true, selfUserId: true },
    });
    if (actors.length === 0) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
    const expiresAt = new Date(Date.now() + this.ttlDays * DAY_MS);
    const links: { actorId: string; legalName: string; token: string; expiresAt: Date }[] = [];
    const skipped: { actorId: string; legalName: string; reason: 'COUPLE' | 'LINKED' }[] = [];
    for (const actor of actors) {
      if (actor.kind === ActorKind.COUPLE) {
        skipped.push({ actorId: actor.id, legalName: actor.legalName, reason: 'COUPLE' });
        continue;
      }
      if (actor.selfUserId) {
        skipped.push({ actorId: actor.id, legalName: actor.legalName, reason: 'LINKED' });
        continue;
      }
      const token = randomBytes(24).toString('base64url');
      await this.prisma.$transaction([
        this.prisma.actorLinkToken.updateMany({ where: { actorId: actor.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
        this.prisma.actorLinkToken.create({ data: { actorId: actor.id, tokenHash: hashLinkToken(token), createdById: adminId, expiresAt } }),
      ]);
      await this.audit.record(adminId, 'ACTOR_LINK_ISSUE', 'ACTOR', actor.id, { expiresAt: expiresAt.toISOString() });
      links.push({ actorId: actor.id, legalName: actor.legalName, token, expiresAt });
    }
    return { links, skipped };
  }

  async revoke(adminId: string, actorId: string) {
    const { count } = await this.prisma.actorLinkToken.updateMany({ where: { actorId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count > 0) await this.audit.record(adminId, 'ACTOR_LINK_REVOKE', 'ACTOR', actorId);
    return { revoked: count };
  }

  /** 아티스트별 링크 상태(운영자 목록·상세) — 아직 안 쓴 유효한 링크가 있으면 만료 시각 */
  async pendingMap(actorIds: string[]): Promise<Map<string, Date>> {
    if (actorIds.length === 0) return new Map();
    const rows = await this.prisma.actorLinkToken.findMany({
      where: { actorId: { in: actorIds }, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { actorId: true, expiresAt: true },
    });
    return new Map(rows.map((row) => [row.actorId, row.expiresAt]));
  }

  /** 링크를 연 화면 — 누구의 연결 링크인지(로그인 전에도). 쓸 수 없는 링크면 그 이유 */
  async preview(token: string) {
    const row = await this.prisma.actorLinkToken.findUnique({
      where: { tokenHash: hashLinkToken(token) },
      select: { expiresAt: true, usedAt: true, revokedAt: true, actor: { select: { legalName: true, officialProfileImageUrl: true, chatProfileImageUrl: true } } },
    });
    if (!row || row.revokedAt) return { state: 'INVALID' as const };
    const actor = {
      legalName: row.actor.legalName,
      photoUrl: await this.media.resolveImageUrl(row.actor.officialProfileImageUrl ?? row.actor.chatProfileImageUrl),
    };
    if (row.usedAt) return { state: 'USED' as const, actor };
    if (row.expiresAt <= new Date()) return { state: 'EXPIRED' as const, actor };
    return { state: 'VALID' as const, actor, expiresAt: row.expiresAt };
  }

  /**
   * 로그인한 계정을 이 아티스트에 연결 — 역할을 아티스트로 바꾸고 본인 계정으로 지정, 링크는 사용 처리. 운영자 역할 변경과 같은 기준으로
   * 구독 중인 팬 계정·운영자·소속사 직원 계정은 막음. 같은 계정으로 다시 누르면 그대로 성공(두 번 눌러도 안전).
   */
  async claim(userId: string, token: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const link = await tx.actorLinkToken.findUnique({
        where: { tokenHash: hashLinkToken(token) },
        select: { id: true, actorId: true, expiresAt: true, usedAt: true, usedByUserId: true, revokedAt: true },
      });
      if (!link || link.revokedAt) throw new BadRequestException(appError('LINK_INVALID'));
      if (link.usedAt) {
        if (link.usedByUserId === userId) return { actorId: link.actorId, already: true };
        throw new BadRequestException(appError('LINK_USED'));
      }
      if (link.expiresAt <= new Date()) throw new BadRequestException(appError('LINK_EXPIRED'));

      const actor = await tx.actor.findUniqueOrThrow({ where: { id: link.actorId }, select: { id: true, kind: true, selfUserId: true } });
      if (actor.kind === ActorKind.COUPLE) throw new BadRequestException(appError('LINK_INVALID'));
      if (actor.selfUserId && actor.selfUserId !== userId) throw new ConflictException(appError('ACTOR_ALREADY_HAS_ACCOUNT'));

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true, deletedAt: true, _count: { select: { subscriptions: { where: { cancelledAt: null } } } } },
      });
      if (user.deletedAt) throw new BadRequestException(appError('ACCOUNT_DELETED'));
      if (user.role === Role.ADMIN || user.role === Role.AGENCY_STAFF) throw new BadRequestException(appError('LINK_ROLE_NOT_ALLOWED'));
      if (user.role === Role.ACTOR) {
        const other = await tx.actor.findUnique({ where: { selfUserId: userId }, select: { id: true } });
        if (other && other.id !== actor.id) throw new ConflictException(appError('ACCOUNT_ALREADY_LINKED'));
      }
      if (user._count.subscriptions > 0) throw new BadRequestException(appError('SUBSCRIBED_FAN_ROLE_CHANGE'));

      // 동시에 두 번 눌러도 한 번만(먼저 잡은 쪽)
      const { count } = await tx.actorLinkToken.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: new Date(), usedByUserId: userId } });
      if (count === 0) throw new BadRequestException(appError('LINK_USED'));
      await tx.user.update({ where: { id: userId }, data: { role: Role.ACTOR, agencyId: null } });
      await tx.actor.update({ where: { id: actor.id }, data: { selfUserId: userId } });
      // 같은 아티스트의 다른 안 쓴 링크도 정리
      await tx.actorLinkToken.updateMany({ where: { actorId: actor.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return { actorId: actor.id, already: false };
    });
    if (!result.already) await this.audit.record(userId, 'ACTOR_LINK_CLAIM', 'ACTOR', result.actorId);
    return { actorId: result.actorId };
  }
}
