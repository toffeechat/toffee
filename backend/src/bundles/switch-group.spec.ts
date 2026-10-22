import { describe, expect, it } from 'vitest';
import { storeGroupOf, switchTiming } from './switch-group.js';

const A = { id: 'a', kind: 'SOLO' as const };
const B = { id: 'b', kind: 'SOLO' as const };
const CP = { id: 'cp', kind: 'COUPLE' as const, coupleMembers: [{ memberId: 'a' }, { memberId: 'b' }] };

describe('같은 CP 묶음 구독 그룹(2026-10-22)', () => {
  it('CP방이 하나 든 묶음만 그룹 — 전체는 1단계, 일부는 2단계', () => {
    expect(storeGroupOf([A, B, CP])).toEqual({ roomId: 'cp', level: 1 });
    expect(storeGroupOf([A, CP])).toEqual({ roomId: 'cp', level: 2 });
    expect(storeGroupOf([B, CP])).toEqual({ roomId: 'cp', level: 2 });
    expect(storeGroupOf([A, B])).toBeNull();
  });

  it('애플은 내리기만 다음 갱신 때, 나머지는 바로', () => {
    const full = { roomId: 'cp', level: 1 as const };
    const part = { roomId: 'cp', level: 2 as const };
    expect(switchTiming(part, full, 'IOS')).toBe('now');
    expect(switchTiming(part, part, 'IOS')).toBe('now');
    expect(switchTiming(full, part, 'IOS')).toBe('next-renewal');
    expect(switchTiming(full, part, 'ANDROID')).toBe('now');
    expect(switchTiming(full, part, null)).toBe('now');
  });
});
