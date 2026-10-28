import { generateKeyPairSync } from 'node:crypto';
import appleSignin from 'apple-signin-auth';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { AuthProvider } from '../generated/prisma/enums.js';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ModerationService } from '../moderation/moderation.service.js';
import type { MediaService } from '../storage/media.service.js';

function setup() {
  const prisma = {
    authIdentity: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'victim', role: 'USER' }),
      create: vi.fn().mockResolvedValue({ id: 'new', role: 'USER' }),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  const service = new AuthService({ get: () => undefined } as unknown as ConfigService, {} as JwtService, prisma as unknown as PrismaService, {} as ModerationService, {} as MediaService);
  return { service, prisma };
}

describe('소셜 로그인 계정 합치기', () => {
  it('확인된 이메일이면 같은 이메일 계정에 합침', async () => {
    const { service } = setup();
    await expect(
      service.findOrCreateUser(AuthProvider.GOOGLE, { providerId: 'g1', email: 'a@x.com', emailVerified: true }),
    ).resolves.toEqual({ id: 'victim', role: 'USER' });
  });

  it('확인 안 된 이메일이면 합치지도 저장하지도 않고 새 계정(남의 계정 탈취 방지)', async () => {
    const { service, prisma } = setup();
    await expect(
      service.findOrCreateUser(AuthProvider.KAKAO, { providerId: 'k1', email: 'a@x.com', emailVerified: false }),
    ).resolves.toEqual({ id: 'new', role: 'USER' });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create.mock.calls[0][0].data.email).toBeUndefined();
  });
});

describe('소셜 토큰 확인 보강(2026-09-29)', () => {
  const withConfig = (values: Record<string, string>) =>
    new AuthService({ get: (key: string) => values[key] } as unknown as ConfigService, {} as JwtService, {} as PrismaService, {} as ModerationService, {} as MediaService);

  it('카카오: 다른 앱에서 발급된 토큰이면 거절(KAKAO_APP_ID)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('access_token_info')
        ? new Response(JSON.stringify({ app_id: 999 }))
        : new Response(JSON.stringify({ id: 1, kakao_account: {} })),
    );
    await expect(withConfig({ KAKAO_APP_ID: '123,456' }).verifyKakaoToken('t')).rejects.toThrow();
    await expect(withConfig({ KAKAO_APP_ID: '123,999' }).verifyKakaoToken('t')).resolves.toMatchObject({ providerId: '1' });
    fetchMock.mockRestore();
  });

  it('카카오: KAKAO_APP_ID가 비어 있으면 확인 없이 통과시키지 않고 거절(2026-10-27)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 1, kakao_account: {} })));
    await expect(withConfig({}).verifyKakaoToken('t')).rejects.toThrow();
    await expect(withConfig({ KAKAO_APP_ID: ' ' }).verifyKakaoToken('t')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('LINE: 채널이 여러 개면 idToken의 aud와 맞는 채널로 확인', async () => {
    const bodies: string[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ sub: 'line-user' }));
    });
    const idToken = ['x', Buffer.from(JSON.stringify({ aud: '2002' })).toString('base64url'), 'y'].join('.');
    await expect(withConfig({ LINE_CHANNEL_ID: '2001, 2002' }).verifyLineToken(idToken)).resolves.toMatchObject({ providerId: 'line-user' });
    expect(bodies[0]).toContain('client_id=2002');
    fetchMock.mockRestore();
  });

  it('설정이 없으면 로그인 거절(조용히 통과시키지 않음)', async () => {
    await expect(withConfig({}).verifyAppleToken('t')).rejects.toThrow();
  });
});

describe('PC 웹 소셜 로그인(code 교환)', () => {
  const withConfig = (values: Record<string, string>) =>
    new AuthService({ get: (key: string) => values[key] } as unknown as ConfigService, {} as JwtService, {} as PrismaService, {} as ModerationService, {} as MediaService);

  it('허용한 웹 주소로 돌아온 code만 받음(설정이 없으면 웹 로그인 꺼짐)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(withConfig({ KAKAO_REST_API_KEY: 'k' }).verifyKakaoWebCode('c', 'https://admin.toffee.app/oauth/kakao')).rejects.toThrow();
    await expect(
      withConfig({ KAKAO_REST_API_KEY: 'k', WEB_LOGIN_ORIGINS: 'https://admin.toffee.app' }).verifyKakaoWebCode('c', 'https://evil.example/oauth/kakao'),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('카카오: code → 토큰 → 앱과 같은 확인(앱 ID 포함)', async () => {
    const calls: string[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calls.push(`${String(url)} ${String(init?.body ?? '')}`);
      if (String(url).includes('oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
      if (String(url).includes('access_token_info')) return new Response(JSON.stringify({ app_id: 7 }));
      return new Response(JSON.stringify({ id: 42, kakao_account: {} }));
    });
    const service = withConfig({ KAKAO_REST_API_KEY: 'rest', KAKAO_APP_ID: '7', WEB_LOGIN_ORIGINS: 'https://admin.toffee.app, http://localhost:8081' });
    await expect(service.verifyKakaoWebCode('code-1', 'http://localhost:8081/oauth/kakao')).resolves.toMatchObject({ providerId: '42' });
    expect(calls[0]).toContain('client_id=rest');
    expect(calls[0]).toContain('code=code-1');
    fetchMock.mockRestore();
  });

  it('LINE: code → id_token → verify(웹 채널)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('oauth2/v2.1/token')
        ? new Response(JSON.stringify({ id_token: ['x', Buffer.from(JSON.stringify({ aud: '3003' })).toString('base64url'), 'y'].join('.') }))
        : new Response(JSON.stringify({ sub: 'line-web-user' })),
    );
    const service = withConfig({ LINE_WEB_CHANNEL_ID: '3003', LINE_WEB_CHANNEL_SECRET: 's', LINE_CHANNEL_ID: '2001,3003', WEB_LOGIN_ORIGINS: 'https://admin.toffee.app' });
    await expect(service.verifyLineWebCode('c', 'https://admin.toffee.app/oauth/line')).resolves.toMatchObject({ providerId: 'line-web-user' });
    fetchMock.mockRestore();
  });

  it('애플: .p8 키로 만든 client secret으로 code 교환 → id_token(audience = Services ID) 확인', async () => {
    const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const apple = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = apple.publicKey.export({ format: 'jwk' });
    const idTokenFor = (aud: string) =>
      new JwtService().sign(
        { sub: 'apple-web-user', aud, email: 'a@privaterelay.appleid.com', email_verified: 'true' },
        { privateKey: apple.privateKey.export({ format: 'pem', type: 'pkcs8' }), algorithm: 'RS256', issuer: 'https://appleid.apple.com', keyid: 'test-kid' },
      );
    let audience = 'app.toffee.web';
    let sentSecret = '';
    appleSignin._setFetch((async (url: string, init?: { body?: URLSearchParams }) => {
      if (url.endsWith('/auth/keys')) return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'test-kid' }] }));
      sentSecret = init?.body?.get('client_secret') ?? '';
      return new Response(JSON.stringify({ id_token: idTokenFor(audience) }));
    }) as unknown as typeof fetch);
    try {
      const service = withConfig({
        APPLE_WEB_SERVICES_ID: 'app.toffee.web',
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_SIGNIN_KEY_ID: 'KEY123',
        // .env 한 줄 형식(\n)
        APPLE_SIGNIN_PRIVATE_KEY: (signing.privateKey.export({ format: 'pem', type: 'pkcs8' }) as string).replace(/\n/g, '\\n'),
        WEB_LOGIN_ORIGINS: 'https://admin.toffee.app',
      });
      await expect(service.verifyAppleWebCode('c', 'https://admin.toffee.app/oauth/apple')).resolves.toMatchObject({
        providerId: 'apple-web-user',
        emailVerified: true,
      });
      // client secret = 우리 키로 서명한 JWT(팀 ID·Services ID)
      expect(new JwtService().verify(sentSecret, { publicKey: signing.publicKey.export({ format: 'pem', type: 'spki' }), algorithms: ['ES256'] })).toMatchObject({ iss: 'TEAM123', sub: 'app.toffee.web', aud: 'https://appleid.apple.com' });
      // 다른 Services ID용 토큰은 거절
      audience = 'someone.else';
      await expect(service.verifyAppleWebCode('c', 'https://admin.toffee.app/oauth/apple')).rejects.toThrow();
    } finally {
      appleSignin._setFetch(globalThis.fetch);
    }
  });
});

describe('데모 입장 코드(2026-10-01, 운영자 코드 분리 2026-10-14)', () => {
  const withCode = (code?: string, adminCode?: string, existingRole: string | null = null) => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(existingRole ? { role: existingRole } : null),
        upsert: vi.fn().mockResolvedValue({ id: 'u1', role: existingRole ?? 'USER' }),
      },
    };
    const env: Record<string, string | undefined> = { DEV_LOGIN_CODE: code, DEV_LOGIN_ADMIN_CODE: adminCode };
    const service = new AuthService(
      { get: (key: string) => env[key] } as unknown as ConfigService,
      {} as JwtService,
      prisma as unknown as PrismaService,
      {} as ModerationService,
      {} as MediaService,
    );
    return { service, prisma };
  };

  it('코드가 설정돼 있으면 맞혀야 로그인되고, 틀리거나 없으면 계정을 만들지도 않음', async () => {
    const { service, prisma } = withCode('candy-demo-42');
    await expect(service.devLogin('fan1@toffee.demo', undefined, undefined, 'wrong')).rejects.toThrow();
    await expect(service.devLogin('fan1@toffee.demo')).rejects.toThrow();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    await expect(service.devLogin('fan1@toffee.demo', undefined, undefined, ' candy-demo-42 ')).resolves.toEqual({ id: 'u1', role: 'USER', demoCode: 'common' });
  });

  it('소속사별 등록 코드(컨트롤러가 찾은 id)면 공용 코드 대신 그 코드로 — 운영자 계정은 등록 코드로도 안 됨', async () => {
    const { service } = withCode('candy-demo-42', 'boss-77');
    await expect(service.devLogin('staff@toffee.demo', undefined, undefined, 'gmm-7k3p', 'code-1')).resolves.toEqual({
      id: 'u1',
      role: 'USER',
      demoCode: 'code-1',
    });
    const admin = withCode('candy-demo-42', 'boss-77', 'ADMIN');
    await expect(admin.service.devLogin('admin@toffee.demo', undefined, undefined, 'gmm-7k3p', 'code-1')).rejects.toThrow();
    expect(admin.prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('운영자 계정·운영자 역할 요청은 운영자 코드로만 — 일반 입장 코드로는 안 됨', async () => {
    const admin = withCode('candy-demo-42', 'boss-77', 'ADMIN');
    await expect(admin.service.devLogin('admin@toffee.demo', undefined, undefined, 'candy-demo-42')).rejects.toThrow();
    await expect(admin.service.devLogin('admin@toffee.demo', undefined, undefined, 'boss-77')).resolves.toEqual({ id: 'u1', role: 'ADMIN' });
    // 일반 계정을 운영자로 바꾸려는 요청도
    const fan = withCode('candy-demo-42', 'boss-77');
    await expect(fan.service.devLogin('new@toffee.demo', undefined, 'ADMIN' as never, 'candy-demo-42')).rejects.toThrow();
    expect(fan.prisma.user.upsert).not.toHaveBeenCalled();
    // 운영자 코드가 비어 있으면 운영자 로그인은 막힘
    await expect(withCode('candy-demo-42', undefined, 'ADMIN').service.devLogin('admin@toffee.demo', undefined, undefined, 'candy-demo-42')).rejects.toThrow();
  });

  it('코드가 없으면 예전처럼 코드 없이(로컬 개발, 운영자도)', async () => {
    await expect(withCode(undefined).service.devLogin('fan1@toffee.demo')).resolves.toMatchObject({ id: 'u1' });
    await expect(withCode('  ').service.devLogin('fan1@toffee.demo')).resolves.toMatchObject({ id: 'u1' });
    await expect(withCode(undefined, undefined, 'ADMIN').service.devLogin('admin@toffee.demo')).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('역할은 새 계정을 만들 때만 — 입장 코드로 기존 계정 역할을 바꾸지 못함(2026-10-27)', async () => {
    const { service, prisma } = withCode('candy-demo-42', 'boss-77', 'USER');
    await service.devLogin('fan1@toffee.demo', undefined, 'AGENCY_STAFF' as never, 'candy-demo-42');
    expect(prisma.user.upsert.mock.calls[0][0].update).toEqual({});
    expect(prisma.user.upsert.mock.calls[0][0].create.role).toBe('AGENCY_STAFF');
  });
});

describe('팬 프로필 상태메시지(2026-10-12)', () => {
  const setupProfile = (bannedHit = false) => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        update,
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'u1', nickname: null, nicknameChangedAt: null, createdAt: new Date(), authIdentities: [], agency: null, profileImageUrl: null, birthDate: null }),
      },
    };
    const moderation = { assertNoBannedWords: vi.fn(() => (bannedHit ? Promise.reject(new Error('banned')) : Promise.resolve())) };
    const media = { resolveImageUrl: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(
      { get: () => undefined } as unknown as ConfigService,
      {} as JwtService,
      prisma as unknown as PrismaService,
      moderation as unknown as ModerationService,
      media as unknown as MediaService,
    );
    return { service, update };
  };

  it('공백을 정리해서 저장, 빈 값이면 지움', async () => {
    const { service, update } = setupProfile();
    await service.updateProfile('u1', { statusMessage: '  안녕   하세요 ' });
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'u1' }, data: { statusMessage: '안녕 하세요' } });
    await service.updateProfile('u1', { statusMessage: '   ' });
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'u1' }, data: { statusMessage: null } });
  });

  it('60자 넘거나 금칙어면 거절', async () => {
    await expect(setupProfile().service.updateProfile('u1', { statusMessage: '가'.repeat(61) })).rejects.toThrow();
    await expect(setupProfile(true).service.updateProfile('u1', { statusMessage: '나쁜말' })).rejects.toThrow();
  });
});

describe('팬 답장 자동 번역 설정값(2026-10-19)', () => {
  const getMe = (value?: string) => {
    const prisma = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'u1',
          role: 'ACTOR',
          nicknameChangedAt: null,
          createdAt: new Date('2026-10-01'),
          birthDate: null,
          authIdentities: [],
          agency: null,
          profileImageUrl: null,
          autoTranslate: true,
        }),
      },
    };
    const media = { resolveImageUrl: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(
      { get: (key: string) => (key === 'TRANSLATION_AUTO_FAN_REPLIES' ? value : undefined) } as unknown as ConfigService,
      {} as JwtService,
      prisma as unknown as PrismaService,
      {} as ModerationService,
      media as unknown as MediaService,
    );
    return service.getMe('u1');
  };

  it('기본은 꺼짐(비었거나 모르는 값) — true/1/on일 때만 켜짐', async () => {
    await expect(getMe()).resolves.toMatchObject({ autoTranslate: true, autoTranslateFanReplies: false });
    await expect(getMe('')).resolves.toMatchObject({ autoTranslateFanReplies: false });
    await expect(getMe('no')).resolves.toMatchObject({ autoTranslateFanReplies: false });
    await expect(getMe(' TRUE ')).resolves.toMatchObject({ autoTranslateFanReplies: true });
    await expect(getMe('1')).resolves.toMatchObject({ autoTranslateFanReplies: true });
  });
});

describe('로그인 세션·토큰 갱신(2026-10-27)', () => {
  function sessionSetup() {
    const prisma = {
      authSession: {
        create: vi.fn().mockResolvedValue({ id: 's-new', user: { tokenVersion: 4 } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ tokenVersion: 4 }),
        update: vi.fn().mockResolvedValue({ tokenVersion: 5 }),
      },
    };
    const jwt = new JwtService({ secret: 'test-secret' });
    const service = new AuthService({ get: () => '12h' } as unknown as ConfigService, jwt, prisma as unknown as PrismaService, {} as ModerationService, {} as MediaService);
    return { service, prisma, jwt };
  }
  const payload = (jwt: JwtService, token: string) => jwt.verify<Record<string, unknown>>(token);

  it('로그인하면 세션을 만들고(만료 = JWT_EXPIRES_IN) sid·tv를 담음', async () => {
    const { service, prisma, jwt } = sessionSetup();
    const { accessToken } = await service.issueAccessToken({ id: 'u1', role: 'USER' }, { demoCode: 'common', client: { platform: 'ios', deviceModel: 'iPhone', appVersion: '1.2.0' } as never });
    const data = prisma.authSession.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', platform: 'ios', deviceModel: 'iPhone', appVersion: '1.2.0' });
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(11.9 * 3_600_000);
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
    expect(payload(jwt, accessToken)).toMatchObject({ sub: 'u1', sid: 's-new', tv: 4, dac: 'common' });
  });

  it('갱신은 같은 세션을 연장하고 sid·dac·mfaAt을 그대로(2단계 인증 시각이 늘지 않음)', async () => {
    const { service, prisma, jwt } = sessionSetup();
    const { accessToken } = await service.refreshAccessToken({ id: 'a1', role: 'ADMIN', sessionId: 's1', tokenVersion: 4, demoCode: 'd1', mfaAt: 123 });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany.mock.calls[0][0].where).toEqual({ id: 's1', userId: 'a1', revokedAt: null });
    expect(payload(jwt, accessToken)).toMatchObject({ sid: 's1', tv: 4, dac: 'd1', mfaAt: 123 });
  });

  it('갱신 직전에 세션이 끊겼으면 401', async () => {
    const { service, prisma } = sessionSetup();
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refreshAccessToken({ id: 'u1', role: 'USER', sessionId: 's1', tokenVersion: 0 })).rejects.toThrow();
  });

  it('sid 없는 옛 토큰을 갱신하면 새 세션으로 옮김', async () => {
    const { service, prisma, jwt } = sessionSetup();
    const { accessToken } = await service.refreshAccessToken({ id: 'u1', role: 'USER', tokenVersion: 0 });
    expect(prisma.authSession.create).toHaveBeenCalled();
    expect(payload(jwt, accessToken)).toMatchObject({ sid: 's-new' });
  });

  it('로그아웃은 이 세션만 끊고, 모든 기기 로그아웃은 tokenVersion을 올리고 세션을 전부 끊음', async () => {
    const { service, prisma } = sessionSetup();
    await service.logout({ id: 'u1', role: 'USER', sessionId: 's1' });
    expect(prisma.authSession.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 's1', userId: 'u1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    await service.logoutAll('u1');
    expect(prisma.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'u1' },
      data: { tokenVersion: { increment: 1 }, authSessions: { updateMany: { where: { revokedAt: null } } } },
    });
  });
});

describe('JWT 수명 읽기', () => {
  it('단위별로 읽고 못 읽으면 30일', async () => {
    const { jwtLifetimeMs } = await import('./auth-sessions.js');
    expect(jwtLifetimeMs('30d')).toBe(30 * 86_400_000);
    expect(jwtLifetimeMs('12h')).toBe(12 * 3_600_000);
    expect(jwtLifetimeMs('15m')).toBe(15 * 60_000);
    expect(jwtLifetimeMs(undefined)).toBe(30 * 86_400_000);
    expect(jwtLifetimeMs('soon')).toBe(30 * 86_400_000);
  });
});
