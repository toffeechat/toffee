import { describe, expect, it } from 'vitest';
import { businessInfoHtml, readBusinessInfo } from './business-info.js';

describe('사업자 정보 표시', () => {
  it('상호가 없으면(사업자 등록 전) 아무것도 안 보여 줌', () => {
    expect(readBusinessInfo((key) => (key === 'SUPPORT_EMAIL' ? 'help@toffee.app' : undefined))).toBeNull();
    expect(businessInfoHtml(null, 'ko')).toBe('');
  });

  it('채워진 항목만, 선택 언어 이름표로', () => {
    const env: Record<string, string> = { BUSINESS_NAME: '주식회사 토피', BUSINESS_PHONE: ' 02-000-0000 ', BUSINESS_ADDRESS: '' };
    const info = readBusinessInfo((key) => env[key]);
    expect(info).toEqual({ name: '주식회사 토피', phone: '02-000-0000' });
    const html = businessInfoHtml(info, 'ko');
    expect(html).toContain('상호: 주식회사 토피');
    expect(html).toContain('전화: 02-000-0000');
    expect(html).not.toContain('주소');
  });
});
