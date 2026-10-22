import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ko-KR', languageCode: 'ko', regionCode: 'KR', currencyCode: 'KRW' }] }));

const { displayCurrency, formatPrice } = await import('./price');

describe('표시 통화(2026-10-12)', () => {
  it('기기 통화가 지원 목록에 있으면 그 통화', () => {
    expect(displayCurrency({ languageCode: 'ja', regionCode: 'JP', currencyCode: 'JPY' } as never)).toBe('JPY');
  });
  it('통화 정보가 없으면(웹) 지역, 지역도 없으면 언어로 짐작', () => {
    expect(displayCurrency({ languageCode: 'th', regionCode: 'TH', currencyCode: null } as never)).toBe('THB');
    expect(displayCurrency({ languageCode: 'ko', regionCode: null, currencyCode: null } as never)).toBe('KRW');
  });
  it('모르는 지역은 달러', () => {
    expect(displayCurrency({ languageCode: 'fr', regionCode: 'FR', currencyCode: 'EUR' } as never)).toBe('USD');
  });
  it('바트는 그대로, 다른 통화는 ≈와 반올림', () => {
    expect(formatPrice(9900, 'THB', 'en-US')).toBe('฿99');
    expect(formatPrice(9900, 'KRW', 'ko-KR')).toBe('≈ ₩2,900');
    expect(formatPrice(9900, 'JPY', 'ja-JP')).toBe('≈ ￥400');
    expect(formatPrice(9900, 'USD', 'en-US')).toBe('≈ $2.97');
  });
  it('필리핀 페소·인도네시아 루피아(2026-10-22)', () => {
    expect(displayCurrency({ languageCode: 'en', regionCode: 'PH', currencyCode: 'PHP' } as never)).toBe('PHP');
    expect(displayCurrency({ languageCode: 'id', regionCode: null, currencyCode: null } as never)).toBe('IDR');
  });
  it('나라별 가격을 정한 통화는 ฿149가 그 나라 스토어 가격과 같게(2026-10-22)', () => {
    expect(formatPrice(14900, 'KRW', 'ko-KR')).toBe('≈ ₩4,400');
    expect(formatPrice(14900, 'PHP', 'en-PH')).toBe('≈ ₱179');
    expect(formatPrice(14900, 'IDR', 'id-ID')).toMatch(/^≈ Rp\s39\.000$/);
    expect(formatPrice(14900, 'VND', 'vi-VN')).toMatch(/^≈ 59\.000\s₫$/);
    expect(formatPrice(14900, 'JPY', 'ja-JP')).toBe('≈ ￥600');
    expect(formatPrice(14900, 'MYR', 'ms-MY')).toMatch(/^≈ RM\s?16\.90$/);
  });
});
