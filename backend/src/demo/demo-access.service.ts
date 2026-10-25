import { randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '../common/lifecycle/cron.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../notifications/email.service.js';
import { Role } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';
import type { ClientInfo } from '../access-log/client-info.js';
import { ACCESS_LOG_RETENTION_DAYS } from '../access-log/access-log.service.js';

/** 토큰의 `dac`가 이 값이면 공용 코드(DEV_LOGIN_CODE, 내부 테스트용) — 기록은 남기고 메일은 안 보냄 */
export const COMMON_DEMO_CODE = 'common';
// 이만큼 활동이 없다가 다시 들어오면 "새 접속" — 알림 메일 한 통(2026-10-19 사용자 결정: 둘러보는 동안엔 한 통만)
export const NEW_VISIT_GAP_MS = 30 * 60 * 1000;
// 로그인 유지 중 요청은 코드·역할마다 5분에 한 번만 처리(lastSeenAt 갱신)
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
// 로그인 유지 중 접속 기록 줄은 코드·역할마다 한 시간에 한 줄(회원 접속 기록과 같은 주기)
const VISIT_EVENT_INTERVAL_MS = 60 * 60 * 1000;
// 만료·중지 확인 결과를 재사용하는 시간 — 요청마다 DB를 읽지 않게(중지하면 운영자 화면에서 바로 지움)
const STATUS_CACHE_MS = 60 * 1000;

export type DemoRoleKey = 'agency' | 'artist' | 'fan' | 'other';

export const DEMO_ROLE_LABELS: Record<DemoRoleKey, string> = { agency: '소속사', artist: '아티스트', fan: '팬', other: '기타' };

export function demoRoleOf(role: Role): DemoRoleKey {
  if (role === Role.AGENCY_STAFF) return 'agency';
  if (role === Role.ACTOR) return 'artist';
  if (role === Role.USER) return 'fan';
  return 'other';
}

// 헷갈리는 글자(0·o·1·l·i)를 뺀 자동 생성용 글자
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_FORMAT = /^[a-z0-9-]{4,32}$/;

export function normalizeDemoCode(code: string | null | undefined): string {
  return (code ?? '').trim().toLowerCase();
}

export function generateDemoCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `${part()}-${part()}`;
}

function isActive(row: { expiresAt: Date; revokedAt: Date | null }, now: Date): boolean {
  return !row.revokedAt && row.expiresAt > now;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

// "10/19 20:35"
function formatAt(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`;
}

export interface DemoCodeInput {
  agencyName: string;
  code?: string;
  expiresAt: string;
  note?: string | null;
}

export interface DemoCodeUpdate {
  agencyName?: string;
  expiresAt?: string;
  note?: string | null;
  revoked?: boolean;
}

/**
 * 소속사별 데모 입장 코드(2026-10-19 사용자 결정) — 운영자가 소속사 이름·코드·만료일을 등록하고, 소속사는 그 코드로 웹 데모의
 * [소속사][아티스트][팬] 버튼을 다 씀. 로그인할 때 코드 id를 토큰(`dac`)에 담아 두고 요청마다 만료·중지를 확인(지나면 로그아웃),
 * 30분 넘게 비었다가 새로 들어오면 운영자에게 메일(DEMO_ALERT_EMAIL). 데모 계정은 모든 소속사가 같이 씀 — 코드는 누가 들어왔는지만 구분.
 */
@Injectable()
export class DemoAccessService {
  private readonly logger = new Logger(DemoAccessService.name);
  // 코드 id → 만료 시각(ms, 중지·없음은 0)과 캐시 만료
  private readonly statusCache = new Map<string, { expiresAt: number; until: number }>();
  // `${코드}:${역할}` → 마지막 처리 / 마지막 기록 줄(ms). 서버가 다시 켜지면 비지만 기록이 한 줄 더 생길 뿐
  private readonly lastTouch = new Map<string, number>();
  private readonly lastEvent = new Map<string, number>();
  // 공용 코드는 DB 줄이 없어서 마지막 활동을 메모리에만
  private commonLastSeen: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly email: EmailService,
  ) {}

  /** 로그인 때 받은 코드가 등록된 코드면 그 id(만료·중지면 오류), 아니면 null — 공용 코드 확인은 AuthService */
  async findLoginCode(code: string | undefined): Promise<string | null> {
    const normalized = normalizeDemoCode(code);
    if (!normalized) return null;
    const row = await this.prisma.demoAccessCode.findUnique({ where: { code: normalized } });
    if (!row) return null;
    if (!isActive(row, new Date())) throw new UnauthorizedException(appError('DEMO_CODE_EXPIRED'));
    return row.id;
  }

  /** 요청마다(JwtStrategy) — 코드가 만료·중지됐으면 401(앱은 이유를 보여 주고 로그아웃) */
  async assertActive(dac: string): Promise<void> {
    if (dac === COMMON_DEMO_CODE) return;
    const now = Date.now();
    let cached = this.statusCache.get(dac);
    if (!cached || cached.until <= now) {
      const row = await this.prisma.demoAccessCode.findUnique({ where: { id: dac }, select: { expiresAt: true, revokedAt: true } });
      cached = { expiresAt: row && !row.revokedAt ? row.expiresAt.getTime() : 0, until: now + STATUS_CACHE_MS };
      this.statusCache.set(dac, cached);
    }
    if (cached.expiresAt <= now) throw new UnauthorizedException(appError('DEMO_CODE_EXPIRED'));
  }

  /** 접속 기록·알림 메일 — 응답을 기다리게 하지 않고, 실패해도 로그인·요청은 그대로 */
  touch(dac: string, userRole: Role, kind: 'LOGIN' | 'VISIT', client: ClientInfo): void {
    const now = Date.now();
    const role = demoRoleOf(userRole);
    const key = `${dac}:${role}`;
    if (kind === 'VISIT') {
      const last = this.lastTouch.get(key);
      if (last && now - last < TOUCH_INTERVAL_MS) return;
    }
    this.lastTouch.set(key, now);
    void this.record(dac, key, role, kind, client, new Date(now)).catch((error: Error) =>
      this.logger.warn(`데모 접속 기록 실패: ${error.message}`),
    );
  }

  /** 테스트에서 기다릴 수 있게 분리 */
  async record(dac: string, key: string, role: DemoRoleKey, kind: 'LOGIN' | 'VISIT', client: ClientInfo, now: Date): Promise<void> {
    const { newVisit, first } = await this.markSeen(dac, now);
    const lastEvent = this.lastEvent.get(key);
    if (kind === 'LOGIN' || newVisit || !lastEvent || now.getTime() - lastEvent >= VISIT_EVENT_INTERVAL_MS) {
      this.lastEvent.set(key, now.getTime());
      await this.prisma.demoAccessEvent.create({
        data: { codeId: dac === COMMON_DEMO_CODE ? null : dac, role, kind, newVisit, ...client, createdAt: now },
      });
    }
    if (newVisit && dac !== COMMON_DEMO_CODE) await this.notify(dac, role, first, client, now);
  }

  // 30분 넘게 비어 있었으면 새 접속(횟수 +1) — 조건부 updateMany라 요청이 겹쳐도 한 번만
  private async markSeen(dac: string, now: Date): Promise<{ newVisit: boolean; first: boolean }> {
    const cutoff = new Date(now.getTime() - NEW_VISIT_GAP_MS);
    if (dac === COMMON_DEMO_CODE) {
      const newVisit = this.commonLastSeen === null || this.commonLastSeen < cutoff.getTime();
      this.commonLastSeen = now.getTime();
      return { newVisit, first: false };
    }
    const { count } = await this.prisma.demoAccessCode.updateMany({
      where: { id: dac, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
      data: { lastSeenAt: now, visitCount: { increment: 1 } },
    });
    if (!count) {
      await this.prisma.demoAccessCode.updateMany({ where: { id: dac }, data: { lastSeenAt: now } });
      return { newVisit: false, first: false };
    }
    const { count: first } = await this.prisma.demoAccessCode.updateMany({ where: { id: dac, firstSeenAt: null }, data: { firstSeenAt: now } });
    return { newVisit: true, first: first > 0 };
  }

  private async notify(dac: string, role: DemoRoleKey, first: boolean, client: ClientInfo, now: Date): Promise<void> {
    const row = await this.prisma.demoAccessCode.findUnique({ where: { id: dac }, select: { agencyName: true, code: true, visitCount: true } });
    if (!row) return;
    const subject = first ? `[토피 데모] ${row.agencyName} 첫 접속` : `[토피 데모] ${row.agencyName} 접속 (${row.visitCount}번째)`;
    const to = this.configService.get<string>('DEMO_ALERT_EMAIL')?.trim();
    if (!to) {
      this.logger.log(`${subject} — DEMO_ALERT_EMAIL이 비어 있어 메일은 안 보냄`);
      return;
    }
    const device = [client.platform === 'web' ? '웹' : client.platform, client.deviceModel].filter(Boolean).join(' · ');
    const html = [
      `<p><b>${escapeHtml(row.agencyName)}</b>이(가) 토피 데모에 ${first ? '처음 ' : ''}들어왔어요.</p>`,
      '<ul>',
      `<li>화면: ${DEMO_ROLE_LABELS[role]}</li>`,
      `<li>시각: ${formatAt(now, 'Asia/Seoul')} (한국) · ${formatAt(now, 'Asia/Bangkok')} (태국)</li>`,
      device ? `<li>기기: ${escapeHtml(device)}</li>` : '',
      `<li>입장 코드: ${escapeHtml(row.code)} · 지금까지 ${row.visitCount}번째 접속</li>`,
      '</ul>',
      '<p>30분 넘게 쉬었다가 다시 들어올 때마다 한 통씩 보내요. 전체 기록은 운영자 화면 › 데모 입장 코드에서 볼 수 있어요.</p>',
    ].join('');
    await this.email.send(to, subject, html);
  }

  /** 자동 초기화 전에 — 최근 windowMs 안에 데모를 쓰던 사람이 있는지 */
  async recentlyActive(windowMs = NEW_VISIT_GAP_MS): Promise<boolean> {
    const cutoff = Date.now() - windowMs;
    if (this.commonLastSeen !== null && this.commonLastSeen >= cutoff) return true;
    const count = await this.prisma.demoAccessCode.count({ where: { lastSeenAt: { gte: new Date(cutoff) } } });
    return count > 0;
  }

  // 3개월 지난 데모 접속 기록은 매일 새벽 지움(회원 접속 기록과 같은 기간)
  @Cron('45 4 * * *', { timeZone: 'Asia/Bangkok' })
  async purgeOld(): Promise<number> {
    const before = new Date(Date.now() - ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.demoAccessEvent.deleteMany({ where: { createdAt: { lt: before } } });
    if (count) this.logger.log(`오래된 데모 접속 기록 ${count}건 삭제`);
    return count;
  }

  // ── 운영자 화면 ──────────────────────────────────────────────

  async list() {
    const now = new Date();
    const [codes, roleCounts, common, commonVisits] = await Promise.all([
      this.prisma.demoAccessCode.findMany({ orderBy: [{ lastSeenAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }] }),
      // 역할별 횟수 = 로그인 + 새 접속(로그인 유지 중 한 시간마다 남는 줄은 빼고)
      this.prisma.demoAccessEvent.groupBy({
        by: ['codeId', 'role'],
        where: { OR: [{ kind: 'LOGIN' }, { newVisit: true }] },
        _count: { _all: true },
      }),
      this.prisma.demoAccessEvent.aggregate({ where: { codeId: null }, _min: { createdAt: true }, _max: { createdAt: true } }),
      this.prisma.demoAccessEvent.count({ where: { codeId: null, newVisit: true } }),
    ]);
    const rolesOf = (codeId: string | null) =>
      Object.fromEntries(roleCounts.filter((row) => row.codeId === codeId).map((row) => [row.role, row._count._all])) as Partial<
        Record<DemoRoleKey, number>
      >;
    return {
      codes: codes.map((row) => ({
        id: row.id,
        agencyName: row.agencyName,
        code: row.code,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        note: row.note,
        status: row.revokedAt ? 'REVOKED' : row.expiresAt <= now ? 'EXPIRED' : 'ACTIVE',
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        visitCount: row.visitCount,
        roleCounts: rolesOf(row.id),
        createdAt: row.createdAt,
      })),
      // 공용 코드(내부) — 기록이 있을 때만
      common: common._max.createdAt
        ? { firstSeenAt: common._min.createdAt, lastSeenAt: common._max.createdAt, visitCount: commonVisits, roleCounts: rolesOf(null) }
        : null,
    };
  }

  async create(input: DemoCodeInput) {
    const code = input.code?.trim() ? normalizeDemoCode(input.code) : await this.freshCode();
    await this.assertUsableCode(code);
    return this.prisma.demoAccessCode.create({
      data: { agencyName: input.agencyName.trim(), code, expiresAt: new Date(input.expiresAt), note: input.note?.trim() || null },
    });
  }

  async update(id: string, input: DemoCodeUpdate) {
    const existing = await this.prisma.demoAccessCode.findUnique({ where: { id }, select: { revokedAt: true } });
    if (!existing) throw new NotFoundException(appError('DEMO_CODE_NOT_FOUND'));
    const updated = await this.prisma.demoAccessCode.update({
      where: { id },
      data: {
        ...(input.agencyName !== undefined ? { agencyName: input.agencyName.trim() } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
        ...(input.revoked !== undefined ? { revokedAt: input.revoked ? (existing.revokedAt ?? new Date()) : null } : {}),
      },
    });
    // 중지·만료일 변경을 바로 반영(로그인 중인 사람은 다음 요청에서 로그아웃)
    this.statusCache.delete(id);
    return updated;
  }

  /** 접속 기록 — 코드 id 또는 'common'(공용 코드), 최근 것부터 */
  async events(id: string, limit = 200) {
    return this.prisma.demoAccessEvent.findMany({
      where: { codeId: id === COMMON_DEMO_CODE ? null : id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        role: true,
        kind: true,
        newVisit: true,
        platform: true,
        deviceModel: true,
        osVersion: true,
        appVersion: true,
        ip: true,
        createdAt: true,
      },
    });
  }

  private async freshCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateDemoCode();
      if (!(await this.prisma.demoAccessCode.findUnique({ where: { code }, select: { id: true } }))) return code;
    }
    throw new ConflictException(appError('DEMO_CODE_TAKEN'));
  }

  // 공용·운영자 코드와 같은 값은 막음 — 특히 운영자 코드를 소속사에 나눠 주는 실수를 막으려고
  private async assertUsableCode(code: string): Promise<void> {
    if (!CODE_FORMAT.test(code)) throw new BadRequestException(appError('DEMO_CODE_FORMAT'));
    const reserved = ['DEV_LOGIN_CODE', 'DEV_LOGIN_ADMIN_CODE'].map((key) => normalizeDemoCode(this.configService.get<string>(key)));
    const taken = reserved.includes(code) || !!(await this.prisma.demoAccessCode.findUnique({ where: { code }, select: { id: true } }));
    if (taken) throw new ConflictException(appError('DEMO_CODE_TAKEN'));
  }
}
