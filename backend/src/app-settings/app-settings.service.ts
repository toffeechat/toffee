import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const ID = 'app';
const CACHE_MS = 15_000;

export interface AppSettingsInput {
  maintenanceOn?: boolean;
  maintenanceMessage?: string | null;
  maintenanceUntil?: string | null;
  minVersionIos?: string | null;
  minVersionAndroid?: string | null;
}

/**
 * 앱 설정(2026-10-20) — 점검 모드·앱 최소 버전. 요청마다 읽는 값(점검 가드)이라 15초 기억(여러 서버여도 15초 안에 따라옴).
 * 점검 끝 시각(maintenanceUntil)이 지나면 저절로 꺼진 것으로 봄(운영자가 끄는 걸 잊어도 열림).
 */
@Injectable()
export class AppSettingsService {
  private cache: { at: number; value: Awaited<ReturnType<AppSettingsService['load']>> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private load() {
    return this.prisma.appSetting.findUnique({ where: { id: ID } });
  }

  async get() {
    if (!this.cache || Date.now() - this.cache.at > CACHE_MS) this.cache = { at: Date.now(), value: await this.load() };
    return this.cache.value;
  }

  /**
   * 운영자 앱 설정 화면용 — 아직 한 번도 저장 안 해서 행이 없으면 기본값(2026-10-25). 전엔 null을 돌려줘서 응답 본문이 비고,
   * 앱이 "받은 값 없음"으로 보고 로딩만 계속 돌았음(데모 첫 화면)
   */
  async adminView() {
    const setting = await this.get();
    return (
      setting ?? {
        id: ID,
        maintenanceOn: false,
        maintenanceMessage: null,
        maintenanceUntil: null,
        minVersionIos: null,
        minVersionAndroid: null,
        updatedById: null,
        updatedAt: null,
      }
    );
  }

  /** 지금 점검 중인가 */
  async maintenanceActive(now = new Date()): Promise<boolean> {
    const setting = await this.get();
    return !!setting?.maintenanceOn && (!setting.maintenanceUntil || setting.maintenanceUntil > now);
  }

  /** 앱이 켤 때마다 읽는 공개 설정 */
  async publicConfig() {
    const setting = await this.get();
    const on = await this.maintenanceActive();
    return {
      maintenance: { on, message: on ? (setting?.maintenanceMessage ?? null) : null, until: on ? (setting?.maintenanceUntil ?? null) : null },
      minVersion: { ios: setting?.minVersionIos ?? null, android: setting?.minVersionAndroid ?? null },
    };
  }

  async update(adminId: string, input: AppSettingsInput) {
    const data = {
      ...(input.maintenanceOn !== undefined ? { maintenanceOn: input.maintenanceOn } : {}),
      ...(input.maintenanceMessage !== undefined ? { maintenanceMessage: input.maintenanceMessage?.trim() || null } : {}),
      ...(input.maintenanceUntil !== undefined ? { maintenanceUntil: input.maintenanceUntil ? new Date(input.maintenanceUntil) : null } : {}),
      ...(input.minVersionIos !== undefined ? { minVersionIos: input.minVersionIos?.trim() || null } : {}),
      ...(input.minVersionAndroid !== undefined ? { minVersionAndroid: input.minVersionAndroid?.trim() || null } : {}),
      updatedById: adminId,
    };
    const saved = await this.prisma.appSetting.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
    this.cache = null;
    await this.audit.record(adminId, 'APP_SETTINGS', 'APP', ID, JSON.parse(JSON.stringify(input)));
    return saved;
  }
}
