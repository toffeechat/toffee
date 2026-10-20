import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ActorKind } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';
import { planImport, type CoupleMemberRef, type ImportPlan } from './actor-import.js';
import type { ImportActorsDto } from './dto/import-actors.dto.js';

/**
 * 아티스트·CP 등록(2026-10-19 일괄 등록, 2026-10-20 등록 화면 하나로 — 직접 입력·멤버를 고른 CP방도 같은 길) — dryRun이면 계획(미리보기)만,
 * 아니면 한 트랜잭션으로 아티스트·소속사 이력·CP방을 만듦. 묶음(패키지)은 따로 묶음 상품 화면에서(2026-10-20 사용자 결정).
 * 고칠 줄이 하나라도 있으면 아무것도 안 만듦(반쯤 등록된 상태를 남기지 않게). 사진은 앱이 파일 이름을 맞춰 기존 업로드 경로로 올림.
 */
@Injectable()
export class ActorImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async run(adminId: string, dto: ImportActorsDto) {
    const agencyId = dto.agencyId ?? null;
    if (agencyId && !(await this.prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true } }))) {
      throw new NotFoundException(appError('AGENCY_NOT_FOUND'));
    }
    if (dto.rows.length === 0 && !dto.couples?.length) throw new BadRequestException(appError('IMPORT_INVALID', { count: 1 }));
    const plan = await this.plan(dto, agencyId);
    if (dto.dryRun) return { plan, created: null };
    if (plan.errorCount > 0) throw new BadRequestException(appError('IMPORT_INVALID', { count: plan.errorCount }));

    const releaseAt = dto.releaseAt ? new Date(dto.releaseAt) : null;
    const created = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const rowIds = new Map<number, string>();
      const actors: { id: string; legalName: string }[] = [];
      for (const row of plan.rows.filter((item) => item.status === 'new')) {
        const actor = await tx.actor.create({
          data: {
            legalName: row.legalName,
            chatDisplayName: row.chatDisplayName,
            gender: row.gender,
            monthlyPriceCents: dto.monthlyPriceCents,
            releaseAt,
            agencyId,
            ...(agencyId ? { agencyHistory: { create: { agencyId, startedAt: now } } } : {}),
          },
          select: { id: true, legalName: true },
        });
        rowIds.set(row.index, actor.id);
        actors.push(actor);
      }
      const couples: { id: string; legalName: string }[] = [];
      for (const couple of plan.couples.filter((item) => item.status === 'new')) {
        const memberIds = couple.members.map((ref) => ('row' in ref ? rowIds.get(ref.row)! : ref.actorId));
        const room = await tx.actor.create({
          data: {
            kind: ActorKind.COUPLE,
            legalName: couple.legalName,
            chatDisplayName: couple.legalName.slice(0, 50),
            monthlyPriceCents: dto.couplePriceCents,
            releaseAt,
            coupleMembers: { create: memberIds.map((memberId) => ({ memberId })) },
          },
          select: { id: true, legalName: true },
        });
        couples.push(room);
      }
      return { actors, couples };
    });
    await this.audit.record(adminId, 'ACTOR_IMPORT', agencyId ? 'AGENCY' : 'ACTOR', agencyId ?? created.actors[0]?.id ?? 'none', {
      count: created.actors.length,
      couples: created.couples.length,
      monthlyPriceCents: dto.monthlyPriceCents,
      couplePriceCents: dto.couplePriceCents,
      releaseAt: dto.releaseAt ?? null,
    });
    return { plan, created };
  }

  private async plan(dto: ImportActorsDto, agencyId: string | null): Promise<ImportPlan> {
    const [solos, couples] = await Promise.all([
      this.prisma.actor.findMany({ where: { kind: ActorKind.SOLO }, select: { id: true, legalName: true, agencyId: true } }),
      this.prisma.actor.findMany({ where: { kind: ActorKind.COUPLE }, select: { coupleMembers: { select: { memberId: true } } } }),
    ]);
    const pairs = couples
      .map((couple) => couple.coupleMembers.map((member) => member.memberId))
      .filter((ids): ids is [string, string] => ids.length === 2);
    // 멤버 하나는 줄 번호나 id 중 하나만 — 둘 다 없거나 둘 다 있으면 "못 찾음"으로(줄 번호 -1)
    const explicit = (dto.couples ?? []).map(
      (couple) =>
        couple.members.map((member): CoupleMemberRef => (member.actorId && member.row === undefined ? { actorId: member.actorId } : { row: member.actorId ? -1 : (member.row ?? -1) })) as [
          CoupleMemberRef,
          CoupleMemberRef,
        ],
    );
    return planImport(dto.rows, agencyId, solos, pairs, explicit);
  }
}
