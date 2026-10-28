import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * TOTP(RFC 6238, 30초·6자리·SHA-1 — Google Authenticator·1Password 등 기본값) — 운영자 2단계 인증(2026-10-20). 라이브러리 없이 node:crypto로.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, at = Date.now(), step = 30): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / step)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

/** 앞뒤 한 칸(±30초)까지 허용 — 폰 시계가 조금 틀려도 */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  return matchTotpStep(secret, code, at) !== null;
}

/** 맞은 코드의 시간 칸 번호(30초 단위) — 같은 칸 이하의 코드를 다시 못 쓰게 저장(2026-10-28). 틀리면 null */
export function matchTotpStep(secret: string, code: string, at = Date.now()): number | null {
  const given = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  for (const drift of [-1, 0, 1]) {
    const when = at + drift * 30_000;
    if (timingSafeEqual(Buffer.from(totpCode(secret, when)), Buffer.from(given))) return Math.floor(when / 30_000);
  }
  return null;
}

/** 인증 앱에 넣는 주소(QR 대신 이 글을 그대로 넣거나, 키를 직접 입력) */
export function otpauthUrl(secret: string, account: string, issuer = 'Toffee Admin'): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
