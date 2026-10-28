import { describe, expect, it } from 'vitest';
import { monthOf, monthRange, negativeCarries, SettlementsService, splitRevenue, withoutPlatformShare, type SettlementReport } from './settlements.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import type { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';

describe('정산 계산', () => {
  it('스토어 수수료 → 소속사 몫 / 토피 몫(반올림은 토피 몫에서)', () => {
    // ฿1,000 매출, 수수료 15%, 소속사 70% → 수수료 150, 남은 850 중 소속사 595, 토피 255
    expect(splitRevenue(100000, 15, 70)).toEqual({ storeFeeCents: 15000, netCents: 85000, payoutCents: 59500, platformCents: 25500 });
    const odd = splitRevenue(12901, 15, 70);
    expect(odd.storeFeeCents + odd.payoutCents + odd.platformCents).toBe(12901);
  });

  it('한 달은 태국 시간 1일 0시부터', () => {
    const { from, to } = monthRange('2026-09');
    expect(from.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(monthRange('2026-12').to.toISOString()).toBe('2026-12-31T17:00:00.000Z');
    expect(() => monthRange('2026-13')).toThrow();
    expect(monthOf(new Date('2026-08-31T17:00:00Z'))).toBe('2026-09');
    expect(monthOf(new Date('2026-08-31T16:59:59Z'))).toBe('2026-08');
  });
});

const SAMPLE_REPORT: SettlementReport = {
      month: '2026-09',
      currency: 'THB',
      storeFeePercent: 15,
      defaultSharePercent: 70,
      includesSandbox: false,
      sandboxEnabled: false,
      closed: null,
      payouts: [],
      totals: { grossCents: 0, adjustmentCents: 0, carriedCents: 0, storeFeeCents: 0, netCents: 0, payoutCents: 0, platformCents: 0, refundedCents: 0 },
      agencies: [
        {
          agencyId: 'ag',
          name: '=HYPERLINK("http://evil")',
          sharePercent: 70,
          grossCents: 0,
          adjustmentCents: -9900,
          carriedCents: 0,
          storeFeeCents: 0,
          netCents: 0,
          payoutCents: 0,
          platformCents: 0,
          refundedCents: 0,
          actors: [
            {
              actorId: 'a1',
              name: '@Nawin',
              chargeCount: 0,
              grossCents: 0,
              adjustmentCents: -9900,
              carriedCents: 0,
              storeFeeCents: 0,
              netCents: 0,
              payoutCents: 0,
              platformCents: 0,
              refundedCents: 0,
              rooms: [],
            },
          ],
        },
      ],
    };

interface Charge {
  id: string;
  chargedAt: Date;
  createdAt: Date;
  refundedAt: Date | null;
  amountCents: number;
  kind?: 'PAYMENT' | 'SWITCH_CREDIT' | 'SWITCH_CARRY';
  switchOfChargeId?: string;
}

type Range = { gte?: Date; lt?: Date };
const inRange = (date: Date | null, range?: Range) => !range || (!!date && (!range.gte || date >= range.gte) && (!range.lt || date < range.lt));

/** 배우 1명(소속사 A, 70%)의 결제만 있는 메모리 DB — 마감·조정 규칙 확인용 */
function setup(charges: Charge[], rates: { agencyId: string; fromMonth: string; percent: number | null }[] = []) {
  const closes: { month: string; closedAt: Date; closedById: string | null; snapshot: unknown }[] = [];
  const audits: string[] = [];
  const payouts: { id: string; month: string; payeeKey: string; agencyId: string | null; actorId: string | null; name: string; amountCents: number; paidAt: Date; reference: string | null; memo: string | null }[] = [];
  const db = {
    settlementPayout: {
      findMany: async ({ where }: { where: { month: string; agencyId?: string } }) =>
        payouts.filter((p) => p.month === where.month && (!where.agencyId || p.agencyId === where.agencyId)),
      findUnique: async ({ where }: { where: { month_payeeKey: { month: string; payeeKey: string } } }) =>
        payouts.find((p) => p.month === where.month_payeeKey.month && p.payeeKey === where.month_payeeKey.payeeKey) ?? null,
      findFirst: async ({ where }: { where: { id: string; month: string } }) => payouts.find((p) => p.id === where.id && p.month === where.month) ?? null,
      count: async ({ where }: { where: { month: string } }) => payouts.filter((p) => p.month === where.month).length,
      create: async ({ data }: { data: Omit<(typeof payouts)[number], 'id'> }) => {
        const row = { ...data, id: `p${payouts.length + 1}` };
        payouts.push(row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => payouts.splice(payouts.findIndex((p) => p.id === where.id), 1),
    },
    chargeAllocation: {
      findMany: async ({ where }: { where: { charge: { chargedAt: Range; OR?: { createdAt?: Range; refundedAt?: Range }[] } } }) =>
        charges
          .filter(
            (c) =>
              inRange(c.chargedAt, where.charge.chargedAt) &&
              (!where.charge.OR || where.charge.OR.some((cond) => (cond.createdAt ? inRange(c.createdAt, cond.createdAt) : inRange(c.refundedAt, cond.refundedAt)))),
          )
          .map((c) => ({
            chargeId: c.id,
            amountCents: c.amountCents,
            agencyId: 'ag',
            charge: { chargedAt: c.chargedAt, createdAt: c.createdAt, refundedAt: c.refundedAt, kind: c.kind ?? 'PAYMENT', switchOfChargeId: c.switchOfChargeId ?? null },
            actor: { id: 'a1', legalName: 'Nawin' },
            room: { id: 'a1', legalName: 'Nawin', kind: 'SOLO' },
            agency: { id: 'ag', name: 'A', revenueSharePercent: 70 },
          })),
    },
    settlementClose: {
      findUnique: async ({ where }: { where: { month: string } }) => closes.find((c) => c.month === where.month) ?? null,
      findMany: async () => closes,
      findFirst: async ({ where }: { where: { month: { gt: string } } }) => closes.filter((c) => c.month > where.month.gt).sort()[0] ?? null,
      create: async ({ data }: { data: { month: string; closedById: string; closedAt?: Date; snapshot: unknown } }) => {
        closes.push({ ...data, closedAt: data.closedAt ?? new Date(clock.now) });
      },
      delete: async ({ where }: { where: { month: string } }) => closes.splice(closes.findIndex((c) => c.month === where.month), 1),
    },
    purchaseCharge: {
      findFirst: async ({ where }: { where: { chargedAt: { lt: Date } } }) =>
        charges.filter((c) => c.chargedAt < where.chargedAt.lt).sort((a, b) => +a.chargedAt - +b.chargedAt)[0] ?? null,
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => charges.filter((c) => where.id.in.includes(c.id)),
    },
    user: { findUnique: async () => ({ displayName: '운영자' }) },
    agencyShareRate: { findMany: async ({ where }: { where: { agencyId?: string } }) => rates.filter((r) => !where.agencyId || r.agencyId === where.agencyId) },
  };
  const clock = { now: new Date('2026-10-05T00:00:00Z') };
  const service = new SettlementsService(
    db as unknown as PrismaService,
    { get: (key: string) => (key === 'ENABLE_SANDBOX_SUBSCRIBE' ? 'true' : undefined) } as unknown as ConfigService,
    { record: async (_admin: string, action: string) => audits.push(action) } as unknown as AuditService,
  );
  return { service, clock, closes, audits, charges, payouts, rates };
}

const at = (iso: string) => new Date(iso);

describe('정산 마감', () => {
  it('마감한 달은 저장한 표 그대로, 마감 뒤 환불은 다음 달 조정(음수)', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
      { id: 'c2', chargedAt: at('2026-10-02T00:00:00Z'), createdAt: at('2026-10-02T00:00:00Z'), refundedAt: null, amountCents: 5000 },
    ]);
    await t.service.close('admin', '2026-09', undefined, t.clock.now);
    expect(t.audits).toEqual(['SETTLEMENT_CLOSE']);
    // 마감 뒤에 9월 결제가 환불됨
    t.charges[0].refundedAt = at('2026-10-06T00:00:00Z');
    const september = await t.service.report('2026-09');
    expect(september.closed).toMatchObject({ byName: '운영자' });
    expect(september.totals.grossCents).toBe(10000);
    expect(september.totals.refundedCents).toBe(0);
    const october = await t.service.report('2026-10');
    expect(october.totals).toMatchObject({ grossCents: 5000, adjustmentCents: -10000 });
    // 정산 대상 = 5,000 - 10,000 → 지급액 음수(다음 지급에서 차감)
    expect(october.totals.payoutCents).toBeLessThan(0);
  });

  it('마감 뒤 늦게 기록된 지난달 결제는 다음 달 조정(양수), 마감 전 환불은 조정 없음', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: at('2026-09-20T00:00:00Z'), amountCents: 10000 },
    ]);
    await t.service.close('admin', '2026-09', undefined, t.clock.now);
    t.charges.push({ id: 'late', chargedAt: at('2026-09-25T00:00:00Z'), createdAt: at('2026-10-07T00:00:00Z'), refundedAt: null, amountCents: 3000 });
    const october = await t.service.report('2026-10');
    expect(october.totals).toMatchObject({ grossCents: 0, adjustmentCents: 3000, refundedCents: 0 });
  });

  it('마감 안 한 달의 환불은 그 달 안에서만(조정 아님)', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: at('2026-10-06T00:00:00Z'), amountCents: 10000 },
    ]);
    expect((await t.service.report('2026-09')).totals).toMatchObject({ grossCents: 0, refundedCents: 10000 });
    expect((await t.service.report('2026-10')).totals.adjustmentCents).toBe(0);
  });

  it('끝나지 않은 달·순서 어긋난 마감·중복 마감·순서 어긋난 취소는 거절', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-08-10T00:00:00Z'), createdAt: at('2026-08-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
    ]);
    await expect(t.service.close('admin', '2026-10', undefined, t.clock.now)).rejects.toThrow('끝나지 않은');
    await expect(t.service.close('admin', '2026-09', undefined, t.clock.now)).rejects.toThrow('2026-08');
    await t.service.close('admin', '2026-08', undefined, t.clock.now);
    await expect(t.service.close('admin', '2026-08', undefined, t.clock.now)).rejects.toThrow('이미 마감');
    await t.service.close('admin', '2026-09', undefined, t.clock.now);
    await expect(t.service.reopen('admin', '2026-08')).rejects.toThrow('2026-09');
    await t.service.reopen('admin', '2026-09');
    expect((await t.service.report('2026-09')).closed).toBeNull();
    expect(t.audits).toEqual(['SETTLEMENT_CLOSE', 'SETTLEMENT_CLOSE', 'SETTLEMENT_REOPEN']);
  });
});

describe('음수 지급액 이월(2026-10-27)', () => {
  it('마감한 달의 지급액이 음수면 다음 달 조정으로 넘어가 다음 지급에서 빠짐 — 양수가 되면 더 안 넘어감', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
      { id: 'c2', chargedAt: at('2026-10-02T00:00:00Z'), createdAt: at('2026-10-02T00:00:00Z'), refundedAt: null, amountCents: 5000 },
      { id: 'c3', chargedAt: at('2026-11-02T00:00:00Z'), createdAt: at('2026-11-02T00:00:00Z'), refundedAt: null, amountCents: 20000 },
    ]);
    await t.service.close('admin', '2026-09', undefined, t.clock.now);
    t.charges[0].refundedAt = at('2026-10-06T00:00:00Z');
    await t.service.close('admin', '2026-10', undefined, at('2026-11-05T00:00:00Z'));
    expect((await t.service.report('2026-10')).totals.payoutCents).toBeLessThan(0);
    const november = await t.service.report('2026-11');
    // 10월 정산 대상(5,000 - 10,000 = -5,000)이 11월 조정으로 → 20,000 - 5,000 = 15,000의 85%의 70%
    expect(november.totals).toMatchObject({ grossCents: 20000, adjustmentCents: -5000, carriedCents: -5000, payoutCents: 8925 });
    await t.service.close('admin', '2026-11', undefined, at('2026-12-05T00:00:00Z'));
    expect((await t.service.report('2026-12')).totals).toMatchObject({ adjustmentCents: 0, carriedCents: 0 });
  });

  it('소속사는 합계가 음수일 때만(배우끼리 상계), 무소속은 배우마다', () => {
    const actor = (actorId: string, grossCents: number, adjustmentCents: number, payoutCents: number) => ({ actorId, name: actorId, grossCents, adjustmentCents, payoutCents });
    const carries = negativeCarries({
      agencies: [
        { agencyId: 'ag', name: 'A', sharePercent: 70, payoutCents: 100, actors: [actor('a1', 0, -1000, -595), actor('a2', 2000, 0, 1190)] },
        { agencyId: 'bg', name: 'B', sharePercent: 60, payoutCents: -300, actors: [actor('b1', 100, -800, -357), actor('b2', 200, 0, 102)] },
        { agencyId: null, name: null, sharePercent: 60, payoutCents: 0, actors: [actor('x1', 0, -500, -255), actor('x2', 500, 0, 255)] },
      ],
    } as never);
    expect(carries.map((carry) => [carry.actor.actorId, carry.cents])).toEqual([
      ['b1', -700],
      ['b2', 200],
      ['x1', -500],
    ]);
  });
});

describe('동시 마감(2026-10-27)', () => {
  it('다른 요청이 먼저 마감해 고유 제약에 걸리면 500 대신 "이미 마감"', async () => {
    const t = setup([{ id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: null, amountCents: 10000 }]);
    const db = (t.service as unknown as { prisma: { settlementClose: { create: () => Promise<void> } } }).prisma;
    db.settlementClose.create = () => Promise.reject(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }));
    await expect(t.service.close('admin', '2026-09', undefined, t.clock.now)).rejects.toThrow('이미 마감');
  });
});

describe('정산 지급 기록', () => {
  it('마감한 달에만, 표에 있는 받는 쪽에만, 한 번만 — 기록이 있으면 마감 취소 불가, 지우면 가능', async () => {
    const t = setup([
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
    ]);
    await expect(t.service.recordPayout('admin', '2026-09', { agencyId: 'ag' })).rejects.toThrow('마감하지 않은');
    await t.service.close('admin', '2026-09', undefined, t.clock.now);
    await expect(t.service.recordPayout('admin', '2026-09', { agencyId: 'other' })).rejects.toThrow('지급할 금액');
    await expect(t.service.recordPayout('admin', '2026-09', { agencyId: 'ag', actorId: 'a1' })).rejects.toThrow('지급할 금액');
    // 금액을 안 적으면 표의 지급액(10,000 - 수수료 15% → 8,500의 70% = 5,950)
    const payout = await t.service.recordPayout('admin', '2026-09', { agencyId: 'ag', reference: ' TX-1 ' }, t.clock.now);
    expect(payout).toMatchObject({ amountCents: 5950, name: 'A', reference: 'TX-1' });
    await expect(t.service.recordPayout('admin', '2026-09', { agencyId: 'ag' })).rejects.toThrow('이미 지급 기록');
    const report = await t.service.report('2026-09');
    expect(report.payouts).toHaveLength(1);
    expect((await t.service.report('2026-09', { agencyId: 'someone-else' })).payouts).toHaveLength(0);
    expect(t.service.toCsv(report).trim().split('\n')[1]).toMatch(/,2026-10-05T00:00:00.000Z$/);
    await expect(t.service.reopen('admin', '2026-09')).rejects.toThrow('지급 기록');
    await t.service.deletePayout('admin', '2026-09', payout.id);
    await t.service.reopen('admin', '2026-09');
    expect(t.audits).toEqual(['SETTLEMENT_CLOSE', 'SETTLEMENT_PAYOUT', 'SETTLEMENT_PAYOUT_DELETE', 'SETTLEMENT_REOPEN']);
  });
});

describe('정산 CSV', () => {
  it('=·+·-·@로 시작하는 이름은 엑셀 수식으로 실행되지 않게 글자로(음수 금액은 그대로)', () => {
    const { service } = setup([]);
    const csv = service.toCsv(SAMPLE_REPORT);
    const row = csv.trim().split('\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain(",'@Nawin,");
    expect(row).toContain(',-99.00,');
  });
});

describe('소속사용 정산표', () => {
  it('토피 몫을 합계·소속사·아티스트 줄에서 모두 뺌', () => {
    const report = withoutPlatformShare(SAMPLE_REPORT);
    expect(report.totals).not.toHaveProperty('platformCents');
    expect(report.agencies[0]).not.toHaveProperty('platformCents');
    expect(report.agencies[0].actors[0]).not.toHaveProperty('platformCents');
    expect(report.agencies[0].actors[0].payoutCents).toBe(0);
  });

  it('소속사 CSV엔 platform 열이 없음', () => {
    const { service } = setup([]);
    const [header, row] = service.toCsv(SAMPLE_REPORT, false, false).trim().split('\n');
    expect(header.replace('\ufeff', '').split(',')).not.toContain('platform');
    expect(row.split(',')).toHaveLength(header.split(',').length);
    expect(service.toCsv(SAMPLE_REPORT).split('\n')[0]).toContain('platform');
  });
});

describe('배분율 이력(2026-10-27)', () => {
  // 창립 파트너: 2027-02부터 70%, 2028-02부터 기본(60%)
  const founding = [
    { agencyId: 'ag', fromMonth: '2027-02', percent: 70 },
    { agencyId: 'ag', fromMonth: '2028-02', percent: null },
  ];

  it('비율을 바꾼 뒤에 마감해도 결제가 속한 달(70%) 비율로', async () => {
    const t = setup([{ id: 'c1', chargedAt: at('2028-01-10T00:00:00Z'), createdAt: at('2028-01-10T00:00:00Z'), refundedAt: null, amountCents: 10000 }], founding);
    await t.service.close('admin', '2028-01', undefined, at('2028-02-05T00:00:00Z'));
    const january = await t.service.report('2028-01');
    expect(january.agencies[0]).toMatchObject({ sharePercent: 70, payoutCents: 5950 });
    expect(january.agencies[0]).not.toHaveProperty('sharePercentsUsed');
  });

  it('마감한 70% 달 결제의 환불은 70%로 빼고, 이 달 결제는 60%로', async () => {
    const t = setup(
      [
        { id: 'c1', chargedAt: at('2028-01-10T00:00:00Z'), createdAt: at('2028-01-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
        { id: 'c2', chargedAt: at('2028-02-03T00:00:00Z'), createdAt: at('2028-02-03T00:00:00Z'), refundedAt: null, amountCents: 20000 },
      ],
      founding,
    );
    await t.service.close('admin', '2028-01', undefined, at('2028-02-05T00:00:00Z'));
    t.charges[0].refundedAt = at('2028-02-10T00:00:00Z');
    const february = await t.service.report('2028-02');
    // 20,000 → 수수료 3,000, 17,000의 60% = 10,200 / -10,000 → 수수료 -1,500, -8,500의 70% = -5,950
    expect(february.agencies[0]).toMatchObject({ sharePercent: 60, sharePercentsUsed: [70, 60], adjustmentCents: -10000, storeFeeCents: 1500, payoutCents: 4250 });
    expect(february.totals.payoutCents + february.totals.platformCents + february.totals.storeFeeCents).toBe(10000);
  });

  it('갈아타기 차감 줄은 원래 결제 달(70%) 비율로 빼고, 원래 결제가 환불되면 차감 줄도 같이 빠짐(2026-10-28)', async () => {
    const t = setup(
      [
        { id: 'c1', chargedAt: at('2028-01-20T00:00:00Z'), createdAt: at('2028-01-20T00:00:00Z'), refundedAt: null, amountCents: 10000 },
        { id: 'cr', chargedAt: at('2028-02-05T00:00:00Z'), createdAt: at('2028-02-05T00:00:00Z'), refundedAt: null, amountCents: -5000, kind: 'SWITCH_CREDIT', switchOfChargeId: 'c1' },
      ],
      founding,
    );
    let february = await t.service.report('2028-02');
    // -5,000 → 수수료 -750, -4,250의 70% = -2,975(이 달 비율 60%였다면 -2,550)
    expect(february.agencies[0]).toMatchObject({ grossCents: -5000, payoutCents: -2975, refundedCents: 0 });
    t.charges[0].refundedAt = at('2028-02-10T00:00:00Z');
    t.charges[1].refundedAt = at('2028-02-10T00:00:00Z');
    february = await t.service.report('2028-02');
    // 환불 칸엔 실제 결제만(차감 줄 -5,000이 환불 금액을 줄이지 않게)
    expect(february.totals).toMatchObject({ grossCents: 0, refundedCents: 0 });
    expect((await t.service.report('2028-01')).totals).toMatchObject({ grossCents: 0, refundedCents: 10000 });
  });

  it('비율이 하나뿐이면 이력이 있든 없든(옛 revenueSharePercent) 결과가 같음', async () => {
    const charges = (): Charge[] => [
      { id: 'c1', chargedAt: at('2026-09-10T00:00:00Z'), createdAt: at('2026-09-10T00:00:00Z'), refundedAt: null, amountCents: 12901 },
      { id: 'c2', chargedAt: at('2026-10-02T00:00:00Z'), createdAt: at('2026-10-02T00:00:00Z'), refundedAt: null, amountCents: 5000 },
    ];
    const run = async (t: ReturnType<typeof setup>) => {
      await t.service.close('admin', '2026-09', undefined, t.clock.now);
      t.charges[0].refundedAt = at('2026-10-06T00:00:00Z');
      return [await t.service.report('2026-09'), await t.service.report('2026-10')].map((report) => ({ ...report, closed: null }));
    };
    const withRow = await run(setup(charges(), [{ agencyId: 'ag', fromMonth: '2000-01', percent: 70 }]));
    expect(withRow).toEqual(await run(setup(charges())));
    expect(withRow[1].agencies[0]).not.toHaveProperty('sharePercentsUsed');
  });

  it('이월로 먼저 생긴 소속사 줄도 표시 비율은 이 달 비율', async () => {
    const t = setup(
      [
        { id: 'c1', chargedAt: at('2028-01-10T00:00:00Z'), createdAt: at('2028-01-10T00:00:00Z'), refundedAt: null, amountCents: 10000 },
        { id: 'c2', chargedAt: at('2028-02-03T00:00:00Z'), createdAt: at('2028-02-03T00:00:00Z'), refundedAt: null, amountCents: 1000 },
      ],
      founding,
    );
    await t.service.close('admin', '2028-01', undefined, at('2028-02-05T00:00:00Z'));
    t.charges[0].refundedAt = at('2028-02-10T00:00:00Z');
    await t.service.close('admin', '2028-02', undefined, at('2028-03-05T00:00:00Z'));
    const march = await t.service.report('2028-03');
    // 2월 표의 음수(1,000@60% - 10,000@70% → 510 - 5,950)가 비율별로 넘어옴 — 표시 비율은 3월(60%)
    expect((await t.service.report('2028-02')).totals.payoutCents).toBe(-5440);
    expect(march.agencies[0]).toMatchObject({ sharePercent: 60, sharePercentsUsed: [70, 60], carriedCents: -9000, payoutCents: -5440 });
  });
});
