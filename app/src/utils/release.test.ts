import { describe, expect, it } from 'vitest';
import { formatBangkokDateTime, isUpcoming, parseBangkokDateTime } from './release';

describe('공개 예정 시각', () => {
  it('미래면 곧 공개, 없거나 지났으면 공개', () => {
    const now = Date.parse('2026-11-01T13:00:00Z');
    expect(isUpcoming(null, now)).toBe(false);
    expect(isUpcoming('2026-11-01T12:59:00Z', now)).toBe(false);
    expect(isUpcoming('2026-11-01T13:01:00Z', now)).toBe(true);
  });

  it('운영자 입력은 태국 시간(UTC+7)', () => {
    expect(parseBangkokDateTime('2026-11-01 20:00')).toBe('2026-11-01T13:00:00.000Z');
    expect(parseBangkokDateTime('2026-11-01T07:05')).toBe('2026-11-01T00:05:00.000Z');
    expect(parseBangkokDateTime('2026-02-30 10:00')).toBeNull();
    expect(parseBangkokDateTime('11/1 8pm')).toBeNull();
    expect(formatBangkokDateTime('2026-11-01T13:00:00.000Z')).toBe('2026-11-01 20:00');
  });
});
