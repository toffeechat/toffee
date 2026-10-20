import { createHash, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminLevel, AuthProvider, Role, SubscriptionEventType, UserStatus } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { nextNicknameChangeAt, normalizeNickname } from '../common/nickname/nickname.js';
import { COMMON_DEMO_CODE } from '../demo/demo-access.service.js';
import { appError } from '../common/i18n/app-error.js';
import { MediaService } from '../storage/media.service.js';
import { userProfileImagePrefix } from '../storage/media-policy.js';

// 팬 상태메시지 최대 길이(2026-10-12, 카톡 60자 참고)
export const STATUS_MESSAGE_MAX_LENGTH = 60;

interface ExternalIdentity {
  providerId: string;
  email: string | null;
  /** 제공자가 "이 이메일은 본인 확인된 것"이라고 보증했는지 — 확인된 이메일만 계정 합치기·저장에 씀 */
  emailVerified: boolean;
  name?: string;
  profileImageUrl?: string;
}

const FETCH_TIMEOUT_MS = 5000;

// 길이가 달라도 비교 시간이 같게 해시끼리 비교
function sameCode(given: string | undefined, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given?.trim() ?? ''), digest(expected));
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly media: MediaService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  // demoCode: 데모 입장 코드로 들어왔으면 그 코드 id(공용 코드면 'common') — 요청마다 만료·중지 확인과 접속 기록에 씀(2026-10-19)
  // mfaAt: 운영자가 2단계 인증 코드를 확인한 시각(ms, 2026-10-20) — 토큰에 담아 운영자 API가 확인
  async issueAccessToken(user: { id: string; role: Role }, demoCode?: string, mfaAt?: number): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role, ...(demoCode ? { dac: demoCode } : {}), ...(mfaAt ? { mfaAt } : {}) });
    return { accessToken };
  }

  // Google/Apple/Naver/Kakao/LINE 자격증명 없이 앱을 끝까지 테스트하기 위한 개발용 로그인.
  // DevOnlyGuard가 프로덕션에서 라우트 자체를 404로 숨김.
  // 공개된 데모 서버(2026-10-01)에선 DEV_LOGIN_CODE(입장 코드)를 맞혀야 함 — 주소만 알면 아무 계정(운영자 포함)으로 들어오는 걸 막으려고.
  // 비어 있으면 예전처럼 코드 없이(로컬 개발).
  // 운영자는 입장 코드를 따로(2026-10-14 사용자 결정): 외부 소속사에 데모 입장 코드를 나눠 주면 이메일만 admin@…으로 바꾸거나 role을 ADMIN으로
  // 보내 운영자 화면(데모 초기화·역할 변경)에 들어갈 수 있었음 → 운영자 계정이거나 운영자 역할을 요청하면 DEV_LOGIN_ADMIN_CODE를 맞혀야 함.
  // 입장 코드가 걸린 서버에서 운영자 코드가 비어 있으면 운영자 로그인은 아예 막힘(로컬 개발처럼 입장 코드가 없으면 예전처럼)
  // 소속사별 입장 코드(2026-10-19): registeredCodeId는 컨트롤러가 DemoAccessService로 찾은 등록 코드 id — 있으면 공용 코드 대신 그걸로
  // 들어온 것. 돌려주는 demoCode는 토큰에 담아 요청마다 만료·중지 확인·접속 기록(운영자는 없음)
  async devLogin(
    email: string,
    name?: string,
    role?: Role,
    code?: string,
    registeredCodeId?: string | null,
  ): Promise<AuthenticatedUser & { demoCode?: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { role: true } });
    const wantsAdmin = role === Role.ADMIN || existing?.role === Role.ADMIN;
    let demoCode: string | undefined;
    if (wantsAdmin) this.assertAdminLoginCode(code);
    else if (registeredCodeId) demoCode = registeredCodeId;
    else if (this.assertDevLoginCode(code)) demoCode = COMMON_DEMO_CODE;
    const user = await this.prisma.user.upsert({
      where: { email },
      update: role ? { role } : {},
      create: { email, displayName: name ?? this.generateFallbackName(), role: role ?? Role.USER },
    });
    return { id: user.id, role: user.role, ...(demoCode ? { demoCode } : {}) };
  }

  // 공용 코드가 걸린 서버면 맞혔을 때 true(접속 기록에 "공용 코드"로), 코드가 없는 서버(로컬 개발)면 false
  private assertDevLoginCode(code: string | undefined): boolean {
    const expected = this.configService.get<string>('DEV_LOGIN_CODE')?.trim();
    if (!expected) return false;
    if (!sameCode(code, expected)) throw new UnauthorizedException(appError('DEV_LOGIN_CODE_INVALID'));
    return true;
  }

  private assertAdminLoginCode(code: string | undefined) {
    // 입장 코드가 없는 서버(로컬 개발)는 예전처럼 코드 없이
    if (!this.configService.get<string>('DEV_LOGIN_CODE')?.trim()) return;
    const expected = this.configService.get<string>('DEV_LOGIN_ADMIN_CODE')?.trim();
    if (!expected || !sameCode(code, expected)) throw new UnauthorizedException(appError('DEV_LOGIN_CODE_INVALID'));
  }

  // ── 소셜 토큰 검증 ──────────────────────────────────────────────

  // 앱 변형(운영/개발)·플랫폼(iOS/웹)마다 클라이언트 ID가 다를 수 있어서 쉼표로 여러 개 허용(2026-09-29) — 예) 애플은 iOS 번들 ID
  // com.toffeechat.app과 개발용 com.toffeechat.app.dev의 idToken aud가 서로 다름. 예전엔 하나만 받아서 개발 빌드 로그인이 막혔음
  private audiences(key: string): string[] {
    const list = (this.configService.get<string>(key) ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (list.length === 0) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: key }));
    return list;
  }

  async verifyGoogleToken(idToken: string): Promise<ExternalIdentity> {
    // 구글은 앱(iOS·안드로이드)도 웹 클라이언트 ID를 audience로 쓰게 설정함(social-sign-in의 webClientId) — 웹 로그인도 같은 값
    const ticket = await this.googleClient.verifyIdToken({ idToken, audience: this.audiences('GOOGLE_CLIENT_ID') });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Google' }));
    return {
      providerId: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name,
      profileImageUrl: payload.picture,
    };
  }

  async verifyAppleToken(idToken: string): Promise<ExternalIdentity> {
    const payload = await appleSignin.verifyIdToken(idToken, { audience: this.audiences('APPLE_CLIENT_ID') });
    if (!payload?.sub) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Apple' }));
    // 애플은 email_verified를 boolean 또는 "true" 문자열로 줌
    const verified = (payload as { email_verified?: boolean | string }).email_verified;
    return { providerId: payload.sub, email: payload.email ?? null, emailVerified: verified === true || verified === 'true' };
  }

  async verifyNaverToken(accessToken: string): Promise<ExternalIdentity> {
    const body = await this.fetchJson<{
      resultcode: string;
      response?: { id: string; email?: string; name?: string; nickname?: string; profile_image?: string };
    }>('https://openapi.naver.com/v1/nid/me', accessToken, 'Naver');
    if (body.resultcode !== '00' || !body.response?.id) {
      throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Naver' }));
    }
    return {
      providerId: body.response.id,
      email: body.response.email ?? null,
      // 네이버는 이메일 확인 여부를 따로 주지 않아서 확인 안 된 것으로 취급(계정 합치기에 안 씀)
      emailVerified: false,
      name: body.response.nickname ?? body.response.name,
      profileImageUrl: body.response.profile_image,
    };
  }

  async verifyKakaoToken(accessToken: string): Promise<ExternalIdentity> {
    // 이 토큰이 우리 앱에서 발급된 것인지 먼저 확인 — /v2/user/me만 부르면 다른 카카오 앱(사용자가 로그인했던 아무 앱)의 토큰으로도
    // 통과해서 토큰 바꿔치기 로그인이 가능했음(2026-09-29 점검). 앱 ID(KAKAO_APP_ID, 운영·개발 앱이면 쉼표로 둘)가 설정돼 있을 때 검사
    const allowedApps = (this.configService.get<string>('KAKAO_APP_ID') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (allowedApps.length > 0) {
      const info = await this.fetchJson<{ app_id?: number }>('https://kapi.kakao.com/v1/user/access_token_info', accessToken, 'Kakao');
      if (info.app_id === undefined || !allowedApps.includes(String(info.app_id))) {
        throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Kakao' }));
      }
    }
    const body = await this.fetchJson<{
      id?: number;
      kakao_account?: {
        email?: string;
        is_email_valid?: boolean;
        is_email_verified?: boolean;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    }>('https://kapi.kakao.com/v2/user/me', accessToken, 'Kakao');
    if (body.id === undefined) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Kakao' }));
    return {
      providerId: String(body.id),
      email: body.kakao_account?.email ?? null,
      emailVerified: body.kakao_account?.is_email_valid === true && body.kakao_account?.is_email_verified === true,
      name: body.kakao_account?.profile?.nickname,
      profileImageUrl: body.kakao_account?.profile?.profile_image_url,
    };
  }

  async verifyLineToken(idToken: string): Promise<ExternalIdentity> {
    // LINE은 idToken 서명 키를 직접 관리하는 대신, LINE의 verify 엔드포인트에
    // id_token + client_id를 보내 검증도 하고 클레임도 같이 받는 방식(네이버/카카오와 동일 패턴)
    // 채널 ID가 여러 개(운영·개발 채널)면 idToken의 aud와 맞는 것으로 — verify는 client_id가 aud와 다르면 실패하므로 하나씩 시도
    const clientIds = this.audiences('LINE_CHANNEL_ID');
    const tokenAudience = decodeJwtAudience(idToken);
    const clientId = clientIds.find((id) => id === tokenAudience) ?? clientIds[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'LINE' }));
    const body = (await res.json()) as { sub?: string; email?: string; name?: string; picture?: string };
    if (!body.sub) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'LINE' }));
    return {
      providerId: body.sub,
      email: body.email ?? null,
      // 라인도 이메일 확인 여부를 보증하지 않음
      emailVerified: false,
      name: body.name,
      profileImageUrl: body.picture,
    };
  }

  // ── PC 웹 로그인: 1회용 code → 토큰(2026-09-29) ─────────────────────
  // 앱은 SDK가 토큰을 바로 주지만 웹은 회사 로그인 페이지 → 우리 주소로 code가 돌아옴 → 서버가 비밀키로 토큰 교환 → 앱과 같은 확인.
  // 같은 회사 "앱"(카카오 앱·네이버 애플리케이션·LINE 채널)에 웹 플랫폼을 추가해 써야 회원 식별값이 앱과 같아서 같은 계정으로 로그인됨.

  /** 돌아올 주소가 우리 웹인지 — WEB_LOGIN_ORIGINS(쉼표)에 없는 주소로 받은 code는 거절. 설정이 없으면 웹 로그인 자체가 꺼짐 */
  private ensureWebRedirect(redirectUri: string, provider: string) {
    const origins = (this.configService.get<string>('WEB_LOGIN_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    let origin: string | null = null;
    try {
      origin = new URL(redirectUri).origin;
    } catch {
      origin = null;
    }
    if (!origin || !origins.includes(origin)) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider }));
  }

  private async postForm<T>(url: string, form: Record<string, string>, provider: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form),
        signal: controller.signal,
      });
    } catch {
      throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider }));
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider }));
    return (await res.json()) as T;
  }

  private required(key: string, provider: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider }));
    return value;
  }

  /** 카카오 웹: REST API 키(+ 클라이언트 시크릿을 켰으면 그것도)로 code → access token → 앱과 같은 확인(앱 ID 포함) */
  async verifyKakaoWebCode(code: string, redirectUri: string): Promise<ExternalIdentity> {
    this.ensureWebRedirect(redirectUri, 'Kakao');
    const secret = this.configService.get<string>('KAKAO_CLIENT_SECRET');
    const body = await this.postForm<{ access_token?: string }>(
      'https://kauth.kakao.com/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: this.required('KAKAO_REST_API_KEY', 'Kakao'),
        redirect_uri: redirectUri,
        code,
        ...(secret ? { client_secret: secret } : {}),
      },
      'Kakao',
    );
    if (!body.access_token) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Kakao' }));
    return this.verifyKakaoToken(body.access_token);
  }

  /** 네이버 웹: 앱과 같은 애플리케이션의 Client ID/Secret으로 code(+state) → access token → 앱과 같은 확인 */
  async verifyNaverWebCode(code: string, state: string | undefined, redirectUri: string): Promise<ExternalIdentity> {
    this.ensureWebRedirect(redirectUri, 'Naver');
    const body = await this.postForm<{ access_token?: string }>(
      'https://nid.naver.com/oauth2.0/token',
      {
        grant_type: 'authorization_code',
        client_id: this.required('NAVER_CLIENT_ID', 'Naver'),
        client_secret: this.required('NAVER_CLIENT_SECRET', 'Naver'),
        code,
        state: state ?? '',
      },
      'Naver',
    );
    if (!body.access_token) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Naver' }));
    return this.verifyNaverToken(body.access_token);
  }

  /** LINE 웹: 채널 ID·시크릿으로 code → id_token → 앱과 같은 확인(LINE_CHANNEL_ID 목록에 이 채널도 있어야 함) */
  async verifyLineWebCode(code: string, redirectUri: string): Promise<ExternalIdentity> {
    this.ensureWebRedirect(redirectUri, 'LINE');
    const body = await this.postForm<{ id_token?: string }>(
      'https://api.line.me/oauth2/v2.1/token',
      {
        grant_type: 'authorization_code',
        client_id: this.required('LINE_WEB_CHANNEL_ID', 'LINE'),
        client_secret: this.required('LINE_WEB_CHANNEL_SECRET', 'LINE'),
        redirect_uri: redirectUri,
        code,
      },
      'LINE',
    );
    if (!body.id_token) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'LINE' }));
    return this.verifyLineToken(body.id_token);
  }

  /**
   * 애플 웹: Services ID(APPLE_WEB_SERVICES_ID)로 받은 code → client secret(팀 ID·키 ID·.p8 서명 키로 매번 5분짜리 JWT를 만듦) → id_token →
   * 앱과 같은 확인(audience는 Services ID). Services ID를 iOS 앱 ID와 같은 그룹(Primary App ID)으로 묶어야 애플 회원 식별값(sub)이 앱과 같음.
   * 이름·이메일 범위를 요청하면 애플이 form_post(POST)로만 돌려줘서 정적 웹으로 못 받음 — 범위 없이 query로 받음(웹은 주로 기존 계정 로그인).
   */
  async verifyAppleWebCode(code: string, redirectUri: string): Promise<ExternalIdentity> {
    this.ensureWebRedirect(redirectUri, 'Apple');
    const clientID = this.required('APPLE_WEB_SERVICES_ID', 'Apple');
    let idToken: string | undefined;
    try {
      const clientSecret = appleSignin.getClientSecret({
        clientID,
        teamID: this.required('APPLE_TEAM_ID', 'Apple'),
        keyIdentifier: this.required('APPLE_SIGNIN_KEY_ID', 'Apple'),
        // .env에 한 줄로 넣을 수 있게 \n을 줄바꿈으로
        privateKey: this.required('APPLE_SIGNIN_PRIVATE_KEY', 'Apple').replace(/\\n/g, '\n'),
      });
      const tokens = await appleSignin.getAuthorizationToken(code, { clientID, redirectUri, clientSecret });
      idToken = tokens?.id_token;
    } catch {
      idToken = undefined;
    }
    if (!idToken) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Apple' }));
    const payload = await appleSignin.verifyIdToken(idToken, { audience: clientID }).catch(() => null);
    if (!payload?.sub) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider: 'Apple' }));
    const verified = (payload as { email_verified?: boolean | string }).email_verified;
    return { providerId: payload.sub, email: payload.email ?? null, emailVerified: verified === true || verified === 'true' };
  }

  private async fetchJson<T>(url: string, accessToken: string, provider: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new UnauthorizedException(appError('SOCIAL_TOKEN_INVALID', { provider }));
    return (await res.json()) as T;
  }

  // ── 소셜 아이덴티티 → User ──────────────────────────────────────

  async findOrCreateUser(
    provider: AuthProvider,
    identity: ExternalIdentity,
  ): Promise<AuthenticatedUser> {
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerId: { provider, providerId: identity.providerId } },
      include: { user: true },
    });
    if (existingIdentity) {
      return { id: existingIdentity.user.id, role: existingIdentity.user.role };
    }

    // 같은 이메일로 이미 가입된 계정이 있으면(다른 제공자로 먼저 가입) 그 계정에 합침 — 단 제공자가 본인 확인한
    // 이메일일 때만. 확인 안 된 이메일로 합치면 남의 이메일을 적어 둔 소셜 계정으로 그 사람 계정에 들어갈 수 있음
    // (2026-09-28 점검). 같은 이유로 확인 안 된 이메일은 저장도 안 함(나중에 진짜 주인이 로그인하면 합쳐질 수 있어서).
    const verifiedEmail = identity.emailVerified ? identity.email : null;
    const existingUserByEmail = verifiedEmail ? await this.prisma.user.findUnique({ where: { email: verifiedEmail } }) : null;

    // 약관 동의는 로그인 방식과 상관없이 앱 온보딩 첫 단계에서 받고 기록함(POST /me/terms-agreement)

    const user =
      existingUserByEmail ??
      (await this.prisma.user.create({
        data: {
          email: verifiedEmail ?? undefined,
          displayName: identity.name ?? this.generateFallbackName(),
        },
      }));

    await this.prisma.authIdentity.create({
      data: { userId: user.id, provider, providerId: identity.providerId },
    });

    return { id: user.id, role: user.role };
  }

  /**
   * 회원 탈퇴(팬 본인) — 개인정보는 지우고 기록만 남김(잠정 정책, STATUS.md 출시 전 확정 정책):
   * - 이메일·이름·닉네임·생년월일·부모 이메일·언어는 삭제, 탈퇴 시각만 남김
   * - 구독은 해지 처리(결제·구독 기록 자체는 전자상거래 법정 보관 기간 동안 유지). 실제 스토어 구독은 앱이 끊을 수
   *   없어서 앱 화면에서 "스토어에서 해지"를 먼저 안내함
   * - 푸시 기기·부모 동의 기록 삭제. 팬 답장 본문은 남기고 작성자는 "탈퇴한 팬"으로 표시
   * - 소셜 로그인 연결을 끊어서 같은 계정으로 새로 가입 가능. 단 영구차단된 계정은 연결을 남겨서 탈퇴→재가입으로
   *   차단을 피하지 못하게 함(다시 로그인하면 계속 "이용이 제한된 계정")
   * 배우·소속사·운영자 계정은 앱에서 탈퇴하지 않고 운영자가 처리(배우 채널·소속사 연결이 걸려 있어서).
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, status: true } });
    if (user.role !== Role.USER) {
      throw new ForbiddenException(appError('STAFF_CANNOT_SELF_DELETE'));
    }
    const now = new Date();
    const active = await this.prisma.subscription.findMany({ where: { userId, cancelledAt: null }, select: { actorId: true } });
    await this.prisma.$transaction([
      this.prisma.subscription.updateMany({ where: { userId, cancelledAt: null }, data: { cancelledAt: now } }),
      this.prisma.purchase.updateMany({ where: { userId, cancelledAt: null }, data: { cancelledAt: now } }),
      this.prisma.subscriptionEvent.createMany({
        data: active.map(({ actorId }) => ({ userId, actorId, type: SubscriptionEventType.CANCELLED, createdAt: now })),
      }),
      this.prisma.pushDevice.deleteMany({ where: { userId } }),
      this.prisma.parentalConsent.deleteMany({ where: { userId } }),
      ...(user.status === UserStatus.BANNED ? [] : [this.prisma.authIdentity.deleteMany({ where: { userId } })]),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: null,
          displayName: '탈퇴한 회원',
          nickname: null,
          nicknameChangedAt: null,
          birthDate: null,
          parentEmail: null,
          profileImageUrl: null,
          statusMessage: null,
          locale: null,
          deletedAt: now,
        },
      }),
    ]);
  }

  private generateFallbackName(): string {
    return `팬${Date.now().toString(36)}`;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        locale: true,
        nickname: true,
        nicknameChangedAt: true,
        createdAt: true,
        birthDate: true,
        birthdayGreetingsEnabled: true,
        // 2026-10-12 실기기 피드백: 마이페이지에서 "무엇으로 가입했는지·가입 이메일" 확인, 팬 프로필, 역할별 알림 설정, 소속사 이름
        email: true,
        profileImageUrl: true,
        statusMessage: true,
        notifyArtistMessages: true,
        notifyIdleAlerts: true,
        autoTranslate: true,
        agency: { select: { name: true } },
        authIdentities: { select: { provider: true }, orderBy: { createdAt: 'asc' } },
        adminLevel: true,
        totpEnabledAt: true,
      },
    });
    // 생년월일은 내려주지 않고 "있는지"만(생일 축하 켜기 화면 안내용)
    const { nicknameChangedAt: _changedAt, createdAt: _createdAt, birthDate, authIdentities, agency, profileImageUrl, adminLevel, totpEnabledAt, ...rest } = user;
    return {
      ...rest,
      // 운영자 권한 단계·2단계 인증(2026-10-20) — 운영자가 아니면 null/false
      adminLevel: user.role === Role.ADMIN ? (adminLevel ?? AdminLevel.OWNER) : null,
      mfaEnabled: user.role === Role.ADMIN && !!totpEnabledAt,
      // 처음 가입한 로그인 수단이 맨 앞, 나중에 같은 이메일로 합쳐진 수단이 뒤
      loginProviders: [...new Set(authIdentities.map((identity) => identity.provider))],
      agencyName: agency?.name ?? null,
      profileImageUrl: await this.media.resolveImageUrl(profileImageUrl),
      hasBirthDate: !!birthDate,
      nicknameChangeAvailableAt: nextNicknameChangeAt(user),
      // 아티스트·소속사 화면의 팬 답장도 자동 번역할지(2026-10-19, 기본 꺼짐 — 답장 수만큼 비용이 쌓여서 "번역 보기"를 눌렀을 때만)
      autoTranslateFanReplies: isOn(this.configService.get<string>('TRANSLATION_AUTO_FAN_REPLIES')),
    };
  }

  // ── 팬 프로필(사진·상태메시지, 2026-10-12) ─────────────────────────
  createProfileImageUpload(userId: string, contentType: string, sizeBytes: number) {
    return this.media.createUploadAt(userProfileImagePrefix(userId), 'PHOTO', contentType, sizeBytes);
  }

  /** 상태메시지(빈 값이면 지움 — 길이·보이지 않는 문자·금칙어 검사), 사진(업로드 키 / null이면 기본 이미지). 바뀐 이전 사진 파일은 지움 */
  async updateProfile(userId: string, changes: { statusMessage?: string; profileImageKey?: string | null }) {
    const data: { statusMessage?: string | null; profileImageUrl?: string | null } = {};
    if (changes.statusMessage !== undefined) {
      const message = changes.statusMessage.normalize('NFC').trim().replace(/\s+/g, ' ');
      if ([...message].length > STATUS_MESSAGE_MAX_LENGTH) {
        throw new BadRequestException(appError('STATUS_MESSAGE_TOO_LONG', { max: STATUS_MESSAGE_MAX_LENGTH }));
      }
      if (/[\p{Cc}\p{Cf}]/u.test(message)) throw new BadRequestException(appError('STATUS_MESSAGE_INAPPROPRIATE'));
      if (message) {
        await this.moderationService.assertNoBannedWords(message).catch(() => {
          throw new BadRequestException(appError('STATUS_MESSAGE_INAPPROPRIATE'));
        });
      }
      data.statusMessage = message || null;
    }
    let previous: string | null = null;
    if (changes.profileImageKey !== undefined) {
      if (changes.profileImageKey !== null) await this.media.verifyAt(userProfileImagePrefix(userId), 'PHOTO', changes.profileImageKey);
      const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profileImageUrl: true } });
      previous = current.profileImageUrl;
      data.profileImageUrl = changes.profileImageKey;
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    if (previous && previous !== data.profileImageUrl) await this.media.deleteQuietly(previous);
    return this.getMe(userId);
  }

  // 역할별 알림 설정(2026-10-12)
  async updateNotificationSettings(userId: string, settings: { notifyArtistMessages?: boolean; notifyIdleAlerts?: boolean }) {
    await this.prisma.user.update({ where: { id: userId }, data: settings });
    return this.getMe(userId);
  }

  // 메시지 자동 번역(2026-10-16) — 앱이 말풍선을 처음부터 번역해서 보여 줄지
  async updateTranslationSettings(userId: string, autoTranslate: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { autoTranslate } });
    return this.getMe(userId);
  }

  // 생일 축하 메시지 받기 켜기/끄기(2026-10-12) — 생년월일을 연령 확인 외 목적으로 쓰는 거라 본인이 켤 때만
  async updateBirthdayGreetings(userId: string, enabled: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { birthdayGreetingsEnabled: enabled } });
    return this.getMe(userId);
  }

  /**
   * 닉네임 정하기/바꾸기 — 중복은 허용(버블 방식)하되 공식·운영자·배우 이름 흉내, 금칙어, 보이지 않는 문자는
   * 막고, 한 번 정한 뒤엔 7일에 한 번만 바꿀 수 있음(처음 정할 때와 가입 후 24시간 안에는 제한 없음).
   */
  async updateNickname(userId: string, raw: string) {
    const nickname = normalizeNickname(raw);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { nickname: true, nicknameChangedAt: true, createdAt: true },
    });
    if (user.nickname === nickname) return this.getMe(userId);

    const availableAt = nextNicknameChangeAt(user);
    if (availableAt) {
      throw new BadRequestException(appError('NICKNAME_CHANGE_LOCKED', { availableAt: availableAt.toISOString() }));
    }
    await this.moderationService.assertNoBannedWords(nickname).catch(() => {
      throw new BadRequestException(appError('NICKNAME_INAPPROPRIATE'));
    });
    const actorNameClash = await this.prisma.actor.findFirst({
      where: {
        OR: [
          { chatDisplayName: { equals: nickname, mode: 'insensitive' } },
          { legalName: { equals: nickname, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (actorNameClash) throw new BadRequestException(appError('NICKNAME_MATCHES_ACTOR'));

    await this.prisma.user.update({ where: { id: userId }, data: { nickname, nicknameChangedAt: new Date() } });
    return this.getMe(userId);
  }

  updateLocale(userId: string, locale: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { locale }, select: { id: true, role: true, locale: true } });
  }

  // 기기 등록 — 토큰은 한 계정에만 속함(같은 폰에서 계정을 바꿔 로그인하면 새 계정으로 옮겨감).
  // 한 계정은 여러 기기를 가질 수 있음.
  async registerPushDevice(userId: string, token: string, platform?: string): Promise<void> {
    await this.prisma.pushDevice.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  // 이 기기만 해제(로그아웃) — 다른 기기 알림은 그대로
  async unregisterPushDevice(userId: string, token: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
  }
}

// LINE idToken의 aud(채널 ID)만 꺼냄 — 서명 검증은 LINE verify 엔드포인트가 함(여기선 어떤 채널로 검증할지 고르는 용도)
function decodeJwtAudience(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { aud?: string | string[] };
    return Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  } catch {
    return undefined;
  }
}

/** 환경변수 켜짐 여부 — true/1/on만 켜짐, 비었거나 그 밖이면 꺼짐 */
export function isOn(value: string | undefined): boolean {
  return ['true', '1', 'on'].includes(value?.trim().toLowerCase() ?? '');
}
