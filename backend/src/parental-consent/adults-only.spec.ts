import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from '../notifications/email.service.js';
import { ParentalConsentService } from './parental-consent.service.js';
import { adultAgeFor } from './minor-age.js';

function yearsAgo(years: number, extraDays = 0): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate() - extraDays));
  return d.toISOString().slice(0, 10);
}

function setup(countryCode: string | null, adultsOnly?: string) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ birthDate: null, countryCode }), updateMany },
  } as unknown as PrismaService;
  const config = { get: (key: string) => (key === 'ADULTS_ONLY' ? adultsOnly : undefined) } as unknown as ConfigService;
  return new ParentalConsentService(prisma, {} as EmailService, config);
}

describe('성인만 가입(기본)', () => {
  // 하루 중 시각에 따라 나라 날짜가 바뀌지 않게 고정(UTC 정오 = 태국 19시·한국 21시)
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('나라별 성년 나이 — 한국 19, 태국 20, 일본 18, 모르는 나라 20', () => {
    expect(adultAgeFor('KR')).toBe(19);
    expect(adultAgeFor('th')).toBe(20);
    expect(adultAgeFor('JP')).toBe(18);
    expect(adultAgeFor(null)).toBe(20);
    expect(adultAgeFor('PH')).toBe(18);
  });

  it('나이는 그 나라 날짜로 — 태국 생일 당일 새벽(UTC로는 전날)에도 생일로 침(2026-10-28)', async () => {
    vi.setSystemTime(new Date('2026-10-28T20:00:00Z')); // 태국 10-29 03:00
    await expect(setup('TH').setBirthDate('u', '2006-10-29')).resolves.toEqual({ parentalConsentStatus: 'NOT_REQUIRED' });
    await expect(setup('TH').setBirthDate('u', '2006-10-30')).resolves.toEqual({ parentalConsentStatus: 'UNDERAGE' });
  });

  it('동시에 두 번 입력하면 뒤에 온 것은 거절(이미 입력됨)', async () => {
    const service = setup('TH');
    ((service as unknown as { prisma: { user: { updateMany: ReturnType<typeof vi.fn> } } }).prisma.user.updateMany).mockResolvedValue({ count: 0 });
    await expect(service.setBirthDate('u', '2000-01-01')).rejects.toThrow();
  });

  it('성년 생일이 지났으면 가입, 하루 모자라면 가입 불가', async () => {
    await expect(setup('KR').setBirthDate('u', yearsAgo(19))).resolves.toEqual({ parentalConsentStatus: 'NOT_REQUIRED' });
    await expect(setup('KR').setBirthDate('u', yearsAgo(19, -1))).resolves.toEqual({ parentalConsentStatus: 'UNDERAGE' });
    await expect(setup('TH').setBirthDate('u', yearsAgo(19))).resolves.toEqual({ parentalConsentStatus: 'UNDERAGE' });
  });

  it('ADULTS_ONLY=false면 예전 부모 동의 방식(한국 14세 미만만 동의 대기)', async () => {
    await expect(setup('KR', 'false').setBirthDate('u', yearsAgo(15))).resolves.toEqual({ parentalConsentStatus: 'NOT_REQUIRED' });
    await expect(setup('KR', 'false').setBirthDate('u', yearsAgo(13))).resolves.toEqual({ parentalConsentStatus: 'PENDING' });
  });
});
