import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, totpCode, verifyTotp } from './totp.js';

describe('TOTP(운영자 2단계 인증)', () => {
  // RFC 6238 부록 B 시험 값(SHA-1, 비밀 "12345678901234567890") — 8자리 값의 끝 6자리
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('RFC 시험 값과 같음', () => {
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(secret, 1_234_567_890_000)).toBe('005924');
  });
  it('base32 왕복, 앞뒤 30초 허용, 형식이 틀리면 거절', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    const now = 1_234_567_890_000;
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, '12345', now)).toBe(false);
  });
});
