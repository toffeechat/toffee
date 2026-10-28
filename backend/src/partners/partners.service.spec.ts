import { pkceChallenge } from './partner-clients.js';
import { PartnersService } from './partners.service.js';

interface Link {
  id: string;
  userId: string;
  partner: string;
  sub: string;
  consentedAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  codeHash: string | null;
  codeExpiresAt: Date | null;
  codeChallenge: string | null;
  codeRedirectUri: string | null;
}

// 메모리 가짜 DB — 이 서비스가 쓰는 조회·갱신만
function fakeDb() {
  const links: Link[] = [];
  const users = new Map([
    ['u1', { status: 'ACTIVE', nickname: '토피팬', displayName: 'Real Name', email: 'fan@example.com', locale: 'th' }],
    ['u2', { status: 'BANNED', nickname: null, displayName: 'x', email: null, locale: null }],
  ]);
  const subs = [
    { userId: 'u1', actorId: 'solo', startedAt: new Date('2026-06-01T00:00:00Z'), cancelledAt: null },
    { userId: 'u1', actorId: 'couple', startedAt: new Date('2026-02-01T00:00:00Z'), cancelledAt: null },
    { userId: 'u1', actorId: 'other', startedAt: new Date('2026-01-01T00:00:00Z'), cancelledAt: null },
  ];
  let seq = 0;
  const match = (l: Link, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (k === 'userId_partner' ? l.userId === (v as Link).userId && l.partner === (v as Link).partner : (l as unknown as Record<string, unknown>)[k] === v));
  const withUser = (l: Link | undefined) => (l ? { ...l, user: users.get(l.userId)! } : null);
  return {
    links,
    partnerLink: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => withUser(links.find((l) => match(l, where))),
      create: async ({ data }: { data: Partial<Link> }) => {
        const row = { id: `l${++seq}`, consentedAt: new Date(), revokedAt: null, lastUsedAt: null, codeHash: null, codeExpiresAt: null, codeChallenge: null, codeRedirectUri: null, ...data } as Link;
        links.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Link> }) => Object.assign(links.find((l) => l.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Link> }) => {
        const rows = links.filter((l) => match(l, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => links.filter((l) => match(l, where)),
    },
    user: { findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null },
    coupleMember: { findMany: async () => [{ coupleId: 'couple', memberId: 'solo' }] },
    subscription: {
      findMany: async ({ where }: { where: { userId: string; actorId: { in: string[] } } }) => subs.filter((s) => s.userId === where.userId && where.actorId.in.includes(s.actorId)),
    },
  };
}

const ENV = { GUMBALL_OAUTH_CLIENT_ID: 'gumball-dev', GUMBALL_OAUTH_CLIENT_SECRET: 'secret-value', GUMBALL_OAUTH_REDIRECT_URIS: 'https://gumball.test/auth/toffee' };
const REDIRECT = 'https://gumball.test/auth/toffee';
const VERIFIER = 'v'.repeat(50);

describe('검볼 토피 연결(PartnersService)', () => {
  let db: ReturnType<typeof fakeDb>;
  let service: PartnersService;
  const saved = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, ENV);
    db = fakeDb();
    service = new PartnersService(db as never);
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const authorize = async (userId = 'u1') => {
    const { redirectTo } = await service.authorize(userId, { clientId: 'gumball-dev', redirectUri: REDIRECT, state: 'state-123', codeChallenge: pkceChallenge(VERIFIER) });
    const url = new URL(redirectTo);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get('state')).toBe('state-123');
    return url.searchParams.get('code')!;
  };
  const exchange = (code: string, over: Record<string, string> = {}) =>
    service.token({ clientId: 'gumball-dev', clientSecret: 'secret-value', code, codeVerifier: VERIFIER, redirectUri: REDIRECT, ...over });

  it('등록 안 된 주소·서비스는 거절', async () => {
    await expect(service.preview('u1', 'gumball-dev', 'https://evil.test/cb')).rejects.toThrow();
    await expect(service.preview('u1', 'nope', REDIRECT)).rejects.toThrow();
    expect(await service.preview('u1', 'gumball-dev', REDIRECT)).toEqual({ partner: 'gumball', name: 'Gumball', linked: false });
  });

  it('동의 → 코드 교환(1회용·PKCE·비밀값) → 서비스용 id·닉네임·이메일', async () => {
    const code = await authorize();
    await expect(exchange(code, { clientSecret: 'wrong' })).rejects.toThrow();
    // 비밀값이 틀린 시도로는 코드가 사라지지 않음(서비스 확인이 먼저)
    const ok = await exchange(code);
    expect(ok).toMatchObject({ nickname: '토피팬', email: 'fan@example.com', locale: 'th' });
    expect(ok.sub).not.toBe('u1');
    await expect(exchange(code)).rejects.toThrow();

    const code2 = await authorize();
    await expect(exchange(code2, { codeVerifier: 'w'.repeat(50) })).rejects.toThrow();
    // PKCE가 틀려도 코드는 버림
    await expect(exchange(code2)).rejects.toThrow();
    expect(await service.preview('u1', 'gumball-dev', REDIRECT)).toMatchObject({ linked: true });
  });

  it('구독 요약 — 개인방·커플방, 다른 아티스트 방은 안 셈', async () => {
    const { sub } = await exchange(await authorize());
    const res = await service.subscriptions({ clientId: 'gumball-dev', clientSecret: 'secret-value', sub, artistIds: ['solo', 'nobody'] }, new Date('2026-10-28T00:00:00Z'));
    expect(res.artists.solo).toEqual({ active: true, continuousMonths: 8, roomIds: ['solo', 'couple'], since: '2026-02-01T00:00:00.000Z' });
    expect(res.artists.nobody).toEqual({ active: false, continuousMonths: 0, roomIds: [], since: null });
    await expect(service.subscriptions({ clientId: 'gumball-dev', clientSecret: 'x', sub, artistIds: ['solo'] })).rejects.toThrow();
  });

  it('팬이 끊으면 구독 조회가 막히고, 다시 연결하면 새 id', async () => {
    const { sub } = await exchange(await authorize());
    expect(await service.myLinks('u1')).toHaveLength(1);
    expect(await service.revoke('u1', 'gumball')).toEqual({ ok: true });
    await expect(service.subscriptions({ clientId: 'gumball-dev', clientSecret: 'secret-value', sub, artistIds: ['solo'] })).rejects.toThrow();
    const again = await exchange(await authorize());
    expect(again.sub).not.toBe(sub);
  });

  it('서비스 쪽에서 끊어도 토피 연결이 끊김(비밀값 필요)', async () => {
    const { sub } = await exchange(await authorize());
    await expect(service.revokeFromPartner({ clientId: 'gumball-dev', clientSecret: 'nope', sub })).rejects.toThrow();
    expect(await service.revokeFromPartner({ clientId: 'gumball-dev', clientSecret: 'secret-value', sub })).toEqual({ ok: true });
    expect(await service.myLinks('u1')).toHaveLength(0);
  });

  it('정지·차단 계정은 연결 불가', async () => {
    await expect(authorize('u2')).rejects.toThrow();
  });
});
