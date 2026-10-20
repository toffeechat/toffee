import { describe, expect, it } from 'vitest';
import { compareVersions } from './version';

describe('앱 버전 비교', () => {
  it('자리마다 숫자로', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.0.9', '1.1')).toBeLessThan(0);
  });
});
