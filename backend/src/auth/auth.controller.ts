import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { NaverLoginDto } from './dto/naver-login.dto.js';
import { KakaoLoginDto } from './dto/kakao-login.dto.js';
import { LineLoginDto } from './dto/line-login.dto.js';
import { WebCodeLoginDto } from './dto/web-code-login.dto.js';
import { DevLoginDto } from './dto/dev-login.dto.js';
import {
  CreateProfileImageUploadDto,
  UpdateNotificationSettingsDto,
  UpdateProfileDto,
  UpdateTranslationSettingsDto,
} from './dto/update-profile.dto.js';
import { UpdateBirthdayGreetingsDto } from './dto/update-birthday-greetings.dto.js';
import { UpdateLocaleDto } from './dto/update-locale.dto.js';
import { PushDeviceDto } from './dto/push-device.dto.js';
import { UpdateNicknameDto } from './dto/update-nickname.dto.js';
import { AuthProvider, Role } from '../generated/prisma/enums.js';
import { Public } from '../common/decorators/public.decorator.js';
import { SkipAdminMfa } from '../common/decorators/admin-access.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DevOnlyGuard } from '../common/guards/dev-only.guard.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { DemoAccessService } from '../demo/demo-access.service.js';
import { AccessLogService } from '../access-log/access-log.service.js';
import { Client, type ClientInfo } from '../access-log/client-info.js';

const LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accessLog: AccessLogService,
    private readonly demoAccess: DemoAccessService,
  ) {}

  // 로그인 성공 → 접속 기록(운영자 회원 관리, 2026-10-14) 남기고 토큰 발급
  private async signIn(user: AuthenticatedUser, method: AuthProvider | 'DEV', client: ClientInfo, demoCode?: string) {
    await this.accessLog.recordLogin(user.id, method, client);
    // 데모 입장 코드로 들어왔으면 소속사별 접속 기록·알림(2026-10-19)
    if (demoCode) this.demoAccess.touch(demoCode, user.role, 'LOGIN', client);
    return this.authService.issueAccessToken(user, demoCode);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyGoogleToken(dto.idToken);
    const user = await this.authService.findOrCreateUser(AuthProvider.GOOGLE, identity);
    return this.signIn(user, AuthProvider.GOOGLE, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('apple')
  async loginWithApple(@Body() dto: AppleLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyAppleToken(dto.idToken);
    // 애플 idToken엔 이름이 없어서, 최초 로그인 때 클라이언트가 보내준 이름을 여기서 덧붙임
    const user = await this.authService.findOrCreateUser(
      AuthProvider.APPLE,
      { ...identity, name: dto.name },
    );
    return this.signIn(user, AuthProvider.APPLE, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('naver')
  async loginWithNaver(@Body() dto: NaverLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyNaverToken(dto.accessToken);
    const user = await this.authService.findOrCreateUser(AuthProvider.NAVER, identity);
    return this.signIn(user, AuthProvider.NAVER, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('kakao')
  async loginWithKakao(@Body() dto: KakaoLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyKakaoToken(dto.accessToken);
    const user = await this.authService.findOrCreateUser(AuthProvider.KAKAO, identity);
    return this.signIn(user, AuthProvider.KAKAO, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('line')
  async loginWithLine(@Body() dto: LineLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyLineToken(dto.idToken);
    const user = await this.authService.findOrCreateUser(AuthProvider.LINE, identity);
    return this.signIn(user, AuthProvider.LINE, client);
  }

  // PC 웹 로그인 — 회사 로그인 페이지가 돌려준 code를 서버가 교환(앱은 위의 토큰 방식)
  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('kakao/web')
  async loginWithKakaoWeb(@Body() dto: WebCodeLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyKakaoWebCode(dto.code, dto.redirectUri);
    return this.signIn(await this.authService.findOrCreateUser(AuthProvider.KAKAO, identity), AuthProvider.KAKAO, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('naver/web')
  async loginWithNaverWeb(@Body() dto: WebCodeLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyNaverWebCode(dto.code, dto.state, dto.redirectUri);
    return this.signIn(await this.authService.findOrCreateUser(AuthProvider.NAVER, identity), AuthProvider.NAVER, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('line/web')
  async loginWithLineWeb(@Body() dto: WebCodeLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyLineWebCode(dto.code, dto.redirectUri);
    return this.signIn(await this.authService.findOrCreateUser(AuthProvider.LINE, identity), AuthProvider.LINE, client);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('apple/web')
  async loginWithAppleWeb(@Body() dto: WebCodeLoginDto, @Client() client: ClientInfo) {
    const identity = await this.authService.verifyAppleWebCode(dto.code, dto.redirectUri);
    return this.signIn(await this.authService.findOrCreateUser(AuthProvider.APPLE, identity), AuthProvider.APPLE, client);
  }

  @Public()
  @UseGuards(DevOnlyGuard)
  @Post('dev-login')
  async devLogin(@Body() dto: DevLoginDto, @Client() client: ClientInfo) {
    // 소속사별로 등록한 입장 코드인지 먼저(만료·중지면 여기서 거절), 아니면 공용·운영자 코드 확인은 devLogin이
    const registeredCodeId = await this.demoAccess.findLoginCode(dto.code);
    const { demoCode, ...user } = await this.authService.devLogin(dto.email, dto.name, dto.role as Role | undefined, dto.code, registeredCodeId);
    return this.signIn(user, 'DEV', client, demoCode);
  }

  // 운영자 2단계 인증 코드 화면 전에도(2026-10-27) — 앱이 역할을 알아야 화면을 고르고 코드 화면을 띄움(자기 정보만)
  @SkipAdminMfa()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  // 푸시 받을 기기 등록 — 앱이 로그인 후, 그리고 FCM이 토큰을 바꿀 때마다 보냄. 여러 기기 가능.
  // 운영자는 2단계 인증 뒤에만(운영자 알림이 푸시로 오므로) — 앱이 앱으로 돌아올 때마다 다시 보내서 코드 확인 뒤 등록됨
  @Put('me/push-devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerPushDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushDeviceDto) {
    await this.authService.registerPushDevice(user.id, dto.token, dto.platform);
  }

  // 로그아웃 시 이 기기만 해제 — 같은 폰으로 다른 계정이 로그인했을 때 앞 사람 알림이 오지 않게. 코드 화면에서 로그아웃해도 해제되게 2단계 인증 예외(2026-10-27)
  @SkipAdminMfa()
  @Post('me/push-devices/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterPushDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushDeviceDto) {
    await this.authService.unregisterPushDevice(user.id, dto.token);
  }

  // 닉네임 정하기/바꾸기(온보딩, 마이페이지)
  @Patch('me/nickname')
  updateNickname(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNicknameDto) {
    return this.authService.updateNickname(user.id, dto.nickname);
  }

  // 생일 축하 메시지 받기(2026-10-12)
  @Patch('me/birthday-greetings')
  updateBirthdayGreetings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateBirthdayGreetingsDto) {
    return this.authService.updateBirthdayGreetings(user.id, dto.enabled);
  }

  // 회원 탈퇴(팬 본인) — 성공하면 앱이 로그아웃
  // 팬 프로필 사진·상태메시지(2026-10-12)
  @Post('me/profile-image/upload')
  createProfileImageUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfileImageUploadDto) {
    return this.authService.createProfileImageUpload(user.id, dto.contentType, dto.sizeBytes);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  // 역할별 알림 설정(2026-10-12) — 소속사: 아티스트 새 메시지 / 아티스트·소속사: 장기 미발송 알림
  @Patch('me/notification-settings')
  updateNotificationSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNotificationSettingsDto) {
    return this.authService.updateNotificationSettings(user.id, dto);
  }

  // 메시지 자동 번역(2026-10-16) — 설정 > 언어
  @Patch('me/translation-settings')
  updateTranslationSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTranslationSettingsDto) {
    return this.authService.updateTranslationSettings(user.id, dto.autoTranslate);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.deleteAccount(user.id);
  }

  // 앱 표시 언어 동기화 — 푸시 등 서버가 만드는 문구의 언어를 정하는 데 씀
  @Patch('me/locale')
  updateLocale(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateLocaleDto) {
    return this.authService.updateLocale(user.id, dto.locale);
  }
}
