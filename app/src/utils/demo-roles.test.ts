import { describe, expect, it } from 'vitest';
import { DEMO_ROLE_EMAILS, isDemoRole, parseDemoRole, visibleDemoRoles } from './demo-roles';

describe('데모 바로 입장 역할', () => {
  it('as 값 → 데모 계정(팬 2·이전 소속사 포함)', () => {
    expect(DEMO_ROLE_EMAILS.fan2).toBe('fan2@toffee.demo');
    expect(DEMO_ROLE_EMAILS.former).toBe('former-staff@toffee.demo');
    for (const email of Object.values(DEMO_ROLE_EMAILS)) expect(email.endsWith('@toffee.demo')).toBe(true);
  });

  it('모르는 as 값은 무시', () => {
    expect(isDemoRole('fan2')).toBe(true);
    expect(isDemoRole('former')).toBe(true);
    expect(isDemoRole('toString')).toBe(false);
    expect(isDemoRole('staff')).toBe(false);
    expect(isDemoRole(null)).toBe(false);
  });

  it('as=fan1은 as=fan과 같은 팬 1 계정', () => {
    expect(parseDemoRole('fan1')).toBe('fan');
    expect(parseDemoRole('fan')).toBe('fan');
    expect(parseDemoRole('fan2')).toBe('fan2');
    expect(parseDemoRole('nobody')).toBeNull();
  });

  it('버튼: 기본 셋, 운영자·주소 전용 역할은 해당될 때만', () => {
    expect(visibleDemoRoles({ showAdmin: false, extra: null })).toEqual(['agency', 'artist', 'fan']);
    expect(visibleDemoRoles({ showAdmin: true, extra: null })).toEqual(['agency', 'artist', 'fan', 'admin']);
    expect(visibleDemoRoles({ showAdmin: false, extra: 'former' })).toEqual(['agency', 'artist', 'fan', 'former']);
    expect(visibleDemoRoles({ showAdmin: false, extra: 'fan' })).toEqual(['agency', 'artist', 'fan']);
  });
});
