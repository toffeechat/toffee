import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 토피 계정으로 로그인할 수 있는 디저트랩 서비스(2026-10-28, 지금은 검볼 하나). 값은 환경 변수로만 — 비어 있으면 그 서비스는 꺼짐(404).
 * GUMBALL_OAUTH_CLIENT_ID / GUMBALL_OAUTH_CLIENT_SECRET / GUMBALL_OAUTH_REDIRECT_URIS(쉼표, 정확히 같은 주소만 허용)
 */
export interface PartnerClient {
  partner: string;
  // 동의 화면에 보일 이름
  name: string;
  clientId: string;
  secretHash: Buffer;
  redirectUris: string[];
}

const PARTNERS = [{ partner: 'gumball', name: 'Gumball', env: 'GUMBALL' }] as const;

const sha = (value: string) => createHash('sha256').update(value).digest();

export function partnerClients(env: NodeJS.ProcessEnv = process.env): PartnerClient[] {
  const out: PartnerClient[] = [];
  for (const p of PARTNERS) {
    const clientId = env[`${p.env}_OAUTH_CLIENT_ID`]?.trim();
    const secret = env[`${p.env}_OAUTH_CLIENT_SECRET`]?.trim();
    const redirectUris = (env[`${p.env}_OAUTH_REDIRECT_URIS`] ?? '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (!clientId || !secret || !redirectUris.length) continue;
    out.push({ partner: p.partner, name: p.name, clientId, secretHash: sha(secret), redirectUris });
  }
  return out;
}

export function findClient(clientId: string, env?: NodeJS.ProcessEnv): PartnerClient | null {
  return partnerClients(env).find((c) => c.clientId === clientId) ?? null;
}

/** 서비스 서버끼리 부를 때 — client_id + client_secret(길이와 상관없이 같은 시간에 비교) */
export function authenticateClient(clientId: string | undefined, secret: string | undefined, env?: NodeJS.ProcessEnv): PartnerClient | null {
  if (!clientId || !secret) return null;
  const client = findClient(clientId, env);
  if (!client) return null;
  return timingSafeEqual(sha(secret), client.secretHash) ? client : null;
}

/** PKCE S256 — base64url(sha256(verifier)) */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
