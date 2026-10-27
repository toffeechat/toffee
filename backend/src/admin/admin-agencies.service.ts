import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActorKind, Role } from '../generated/prisma/enums.js';
import type { CreateAgencyDto, UpdateAgencyDto } from './dto/upsert-agency.dto.js';
import { MediaService } from '../storage/media.service.js';
import { isStorageKey, profileImagePrefix } from '../storage/media-policy.js';
import { appError } from '../common/i18n/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '@nestjs/config';
import type { FoundingShareDto, SetShareRateDto } from './dto/share-rate.dto.js';
import { monthOf, monthRange, nextMonth } from '../settlements/settlements.service.js';
import { shareRateAt, shareRateBook } from '../settlements/share-rates.js';

// 창립 파트너 기본(2026-10-23 사용자 결정, feature-decisions.md) — 본 계약 첫 12개월 70%, 그 뒤 기본값(60%)
const FOUNDING_MONTHS = 12;
const FOUNDING_PERCENT = 70;
const SHARE_RATE_SELECT = { fromMonth: true, percent: true, createdAt: true } as const;

const ADMIN_AGENCY_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  revenueSharePercent: true,
  createdAt: true,
  _count: { select: { actors: true, staff: true } },
} as const;

@Injectable()
export class AdminAgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private get defaultSharePercent() {
    const parsed = Number(this.config.get<string>('AGENCY_REVENUE_SHARE_PERCENT'));
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 60;
  }

  // 운영자용 목록 — 팬 공개 목록(GET /agencies)과 달리 스태프 수까지
  async findAll() {
    const agencies = await this.prisma.agency.findMany({ select: ADMIN_AGENCY_SELECT, orderBy: { name: 'asc' } });
    return Promise.all(agencies.map((agency) => this.toResponse(agency)));
  }

  // 로고는 소속사가 생긴 뒤에 올릴 수 있음(업로드 경로에 소속사 id가 들어감) — 만들 땐 외부 주소만
  async create(adminId: string, dto: CreateAgencyDto) {
    if (isStorageKey(dto.logoUrl)) throw new BadRequestException(appError('AGENCY_LOGO_AFTER_CREATE'));
    await this.ensureNameAvailable(dto.name.trim());
    const agency = await this.prisma.agency.create({
      data: { name: dto.name.trim(), logoUrl: dto.logoUrl ?? null },
      select: ADMIN_AGENCY_SELECT,
    });
    // 작업 기록(2026-10-27) — 소속사는 정산·모니터링 권한의 단위라 누가 만들었는지 남김
    await this.audit.record(adminId, 'AGENCY_CREATE', 'AGENCY', agency.id, { name: agency.name });
    return this.toResponse(agency);
  }

  // logoUrl: POST /admin/uploads(target AGENCY)로 받은 키, 외부 주소, 또는 null(삭제)
  async update(adminId: string, id: string, dto: UpdateAgencyDto) {
    const existing = await this.prisma.agency.findUnique({ where: { id }, select: { logoUrl: true, revenueSharePercent: true } });
    if (!existing) throw new NotFoundException(appError('AGENCY_NOT_FOUND'));
    const name = dto.name?.trim();
    if (name !== undefined) await this.ensureNameAvailable(name, id);
    if (isStorageKey(dto.logoUrl) && dto.logoUrl !== existing.logoUrl) {
      await this.media.verifyAt(profileImagePrefix('AGENCY', id), 'PHOTO', dto.logoUrl);
    }
    // 옛 화면의 배분율 한 칸(2026-10-27) — "이번 달부터" 이력 한 줄로 저장(마감한 지난달은 그대로). revenueSharePercent는 아래 동기화로
    const shareChanged = dto.revenueSharePercent !== undefined && dto.revenueSharePercent !== existing.revenueSharePercent;
    const fromMonth = monthOf(new Date());
    if (shareChanged) {
      await this.prisma.agencyShareRate.upsert({
        where: { agencyId_fromMonth: { agencyId: id, fromMonth } },
        create: { agencyId: id, fromMonth, percent: dto.revenueSharePercent ?? null, createdById: adminId },
        update: { percent: dto.revenueSharePercent ?? null, createdById: adminId },
      });
      await this.syncCurrentShare(id);
    }
    const agency = await this.prisma.agency.update({ where: { id }, data: { name, logoUrl: dto.logoUrl }, select: ADMIN_AGENCY_SELECT });
    // 정산 비율은 돈과 직결 — 누가 언제 바꿨는지 기록
    if (shareChanged) {
      await this.audit.record(adminId, 'AGENCY_SHARE', 'AGENCY', id, { fromMonth, from: existing.revenueSharePercent, to: dto.revenueSharePercent ?? null });
    }
    if (dto.logoUrl !== undefined && dto.logoUrl !== existing.logoUrl && isStorageKey(existing.logoUrl)) {
      await this.media.deleteQuietly(existing.logoUrl);
    }
    return this.toResponse(agency);
  }

  /** 배분율 이력(2026-10-27) — 오래된 달부터 + 이번 달 비율·마지막 마감 달(이 달까지는 못 바꿈) */
  async shareRates(id: string, now = new Date()) {
    const agency = await this.prisma.agency.findUnique({ where: { id }, select: { revenueSharePercent: true } });
    if (!agency) throw new NotFoundException(appError('AGENCY_NOT_FOUND'));
    const [rates, lastClosedMonth] = await Promise.all([
      this.prisma.agencyShareRate.findMany({ where: { agencyId: id }, select: SHARE_RATE_SELECT, orderBy: { fromMonth: 'asc' } }),
      this.lastClosedMonth(),
    ]);
    const currentMonth = monthOf(now);
    const book = shareRateBook(rates.map((rate) => ({ ...rate, agencyId: id })));
    return {
      currentMonth,
      currentPercent: shareRateAt(book, id, currentMonth, this.defaultSharePercent, agency.revenueSharePercent),
      defaultPercent: this.defaultSharePercent,
      lastClosedMonth,
      rates,
    };
  }

  /** fromMonth부터 배분율 바꾸기(같은 달 줄이 있으면 덮어씀) — 마감한 달은 안 됨, 앞으로의 달은 예약 */
  async setShareRate(adminId: string, id: string, dto: SetShareRateDto, now = new Date()) {
    await this.findAgencyOrThrow(id);
    await this.ensureOpenMonth(dto.fromMonth);
    const from = await this.rateAt(id, dto.fromMonth);
    await this.prisma.agencyShareRate.upsert({
      where: { agencyId_fromMonth: { agencyId: id, fromMonth: dto.fromMonth } },
      create: { agencyId: id, fromMonth: dto.fromMonth, percent: dto.percent, createdById: adminId },
      update: { percent: dto.percent, createdById: adminId },
    });
    await this.syncCurrentShare(id, now);
    await this.audit.record(adminId, 'AGENCY_SHARE', 'AGENCY', id, { fromMonth: dto.fromMonth, from, to: dto.percent });
    return this.shareRates(id, now);
  }

  /** 이력 한 줄 지우기 — 그 달부터는 앞 줄의 비율로 돌아감. 마감한 달 줄은 안 됨 */
  async deleteShareRate(adminId: string, id: string, fromMonth: string, now = new Date()) {
    await this.findAgencyOrThrow(id);
    monthRange(fromMonth);
    await this.ensureOpenMonth(fromMonth);
    const row = await this.prisma.agencyShareRate.findUnique({ where: { agencyId_fromMonth: { agencyId: id, fromMonth } }, select: { percent: true } });
    if (!row) throw new NotFoundException(appError('NOT_FOUND'));
    await this.prisma.agencyShareRate.delete({ where: { agencyId_fromMonth: { agencyId: id, fromMonth } } });
    await this.syncCurrentShare(id, now);
    await this.audit.record(adminId, 'AGENCY_SHARE', 'AGENCY', id, { fromMonth, from: row.percent, to: await this.rateAt(id, fromMonth), deleted: true });
    return this.shareRates(id, now);
  }

  /** 창립 파트너 — fromMonth부터 12개월 70%, 그다음 달부터 기본값(두 줄을 한 번에) */
  async applyFoundingShare(adminId: string, id: string, dto: FoundingShareDto, now = new Date()) {
    await this.findAgencyOrThrow(id);
    await this.ensureOpenMonth(dto.fromMonth);
    const months = dto.months ?? FOUNDING_MONTHS;
    const foundingPercent = dto.foundingPercent ?? FOUNDING_PERCENT;
    const afterPercent = dto.afterPercent ?? null;
    let afterMonth = dto.fromMonth;
    for (let i = 0; i < months; i++) afterMonth = nextMonth(afterMonth);
    await this.prisma.$transaction(async (tx) => {
      for (const [fromMonth, percent] of [
        [dto.fromMonth, foundingPercent],
        [afterMonth, afterPercent],
      ] as const) {
        await tx.agencyShareRate.upsert({
          where: { agencyId_fromMonth: { agencyId: id, fromMonth } },
          create: { agencyId: id, fromMonth, percent, createdById: adminId },
          update: { percent, createdById: adminId },
        });
      }
    });
    await this.syncCurrentShare(id, now);
    await this.audit.record(adminId, 'AGENCY_SHARE', 'AGENCY', id, { founding: true, fromMonth: dto.fromMonth, months, foundingPercent, afterMonth, afterPercent });
    return this.shareRates(id, now);
  }

  /** 이력 기준 그 달의 비율(null = 기본값) */
  private async rateAt(id: string, month: string): Promise<number | null> {
    const row = await this.prisma.agencyShareRate.findFirst({ where: { agencyId: id, fromMonth: { lte: month } }, orderBy: { fromMonth: 'desc' }, select: { percent: true } });
    return row?.percent ?? null;
  }

  // Agency.revenueSharePercent는 "이번 달 비율" 표시용 사본(옛 앱 호환) — 이력이 바뀔 때마다 맞춤
  private async syncCurrentShare(id: string, now = new Date()) {
    await this.prisma.agency.update({ where: { id }, data: { revenueSharePercent: await this.rateAt(id, monthOf(now)) } });
  }

  private async lastClosedMonth(): Promise<string | null> {
    const last = await this.prisma.settlementClose.findFirst({ orderBy: { month: 'desc' }, select: { month: true } });
    return last?.month ?? null;
  }

  // 마감한 달(마지막 마감 달까지)의 배분율은 다시 해석하지 않음 — 저장한 표와 이후 조정 계산이 어긋나지 않게
  private async ensureOpenMonth(month: string) {
    monthRange(month);
    const last = await this.lastClosedMonth();
    if (last && month <= last) throw new ConflictException(appError('SHARE_RATE_MONTH_CLOSED', { month: last }));
  }

  private async toResponse({ _count, ...agency }: { id: string; name: string; logoUrl: string | null; revenueSharePercent: number | null; createdAt: Date; _count: { actors: number; staff: number } }) {
    return { ...agency, logoUrl: await this.media.resolveImageUrl(agency.logoUrl), actorCount: _count.actors, staffCount: _count.staff };
  }

  // 배우 소속 변경(이적/무소속 전환) — Actor.agencyId와 ActorAgencyHistory를 반드시 한 트랜잭션에서
  // 같이 바꿈. 이력은 정산(이적 시점 기준 매출 귀속)·계약 분쟁 대응용 기록이고, 모니터링 권한은
  // 현재 소속(Actor.agencyId)으로만 판단함.
  // 작업 기록(2026-10-27) — 소속이 바뀌면 정산 귀속·모니터링 권한이 바뀌므로 from/to를 남김(바뀌지 않았으면 기록 없음)
  async assignActor(adminId: string, actorId: string, agencyId: string | null) {
    if (agencyId) await this.findAgencyOrThrow(agencyId);

    let from: string | null | undefined;
    const result = await this.prisma.$transaction(async (tx) => {
      const actor = await tx.actor.findUnique({ where: { id: actorId }, select: { agencyId: true, kind: true } });
      if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
      // 커플방은 소속사가 없음 — 멤버 배우의 소속사가 각자 모니터링
      if (actor.kind === ActorKind.COUPLE) throw new BadRequestException(appError('NOT_FOR_COUPLE'));
      if (actor.agencyId === agencyId) return this.actorWithAgency(tx, actorId);
      from = actor.agencyId;

      const now = new Date();
      await tx.actorAgencyHistory.updateMany({ where: { actorId, endedAt: null }, data: { endedAt: now } });
      if (agencyId) await tx.actorAgencyHistory.create({ data: { actorId, agencyId, startedAt: now } });
      await tx.actor.update({ where: { id: actorId }, data: { agencyId } });
      return this.actorWithAgency(tx, actorId);
    });
    if (from !== undefined) await this.audit.record(adminId, 'ACTOR_AGENCY', 'ACTOR', actorId, { from, to: agencyId });
    return result;
  }

  async actorHistory(actorId: string) {
    const actor = await this.prisma.actor.findUnique({ where: { id: actorId }, select: { id: true } });
    if (!actor) throw new NotFoundException(appError('ACTOR_NOT_FOUND'));
    return this.prisma.actorAgencyHistory.findMany({
      where: { actorId },
      select: { id: true, startedAt: true, endedAt: true, agency: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  // 스태프 계정의 소속사 지정 — 같은 소속사 배우 전원을 모니터링하게 됨(직원별 담당 배우 구분 없음)
  // 작업 기록(2026-10-27) — 직원 소속이 바뀌면 그 소속사 아티스트 전원의 대화·통계를 보게 되므로 from/to를 남김
  async assignStaff(adminId: string, userId: string, agencyId: string | null) {
    if (agencyId) await this.findAgencyOrThrow(agencyId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, agencyId: true } });
    if (!user) throw new NotFoundException(appError('USER_NOT_FOUND'));
    if (agencyId && user.role !== Role.AGENCY_STAFF) {
      throw new BadRequestException(appError('AGENCY_STAFF_ROLE_REQUIRED'));
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { agencyId },
      select: { id: true, displayName: true, role: true, agency: { select: { id: true, name: true } } },
    });
    if (user.agencyId !== agencyId) await this.audit.record(adminId, 'STAFF_AGENCY', 'USER', userId, { from: user.agencyId, to: agencyId });
    return updated;
  }

  private actorWithAgency(tx: Pick<PrismaService, 'actor'>, actorId: string) {
    return tx.actor.findUniqueOrThrow({
      where: { id: actorId },
      select: { id: true, legalName: true, agency: { select: { id: true, name: true, logoUrl: true } } },
    });
  }

  private async findAgencyOrThrow(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id }, select: { id: true } });
    if (!agency) throw new NotFoundException(appError('AGENCY_NOT_FOUND'));
    return agency;
  }

  private async ensureNameAvailable(name: string, exceptId?: string) {
    const existing = await this.prisma.agency.findUnique({ where: { name }, select: { id: true } });
    if (existing && existing.id !== exceptId) throw new ConflictException(appError('AGENCY_NAME_TAKEN'));
  }
}
