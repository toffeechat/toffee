import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../storage/media.service.js';

/**
 * 내 정보 받기(2026-10-20, 태국 PDPA 열람·이동권) — 회원 한 명에 대해 우리가 가진 기록을 JSON 한 파일로. 본인(앱 마이페이지)과 운영자(회원 상세,
 * 작업 기록 USER_EXPORT)가 같은 내용을 받음. 로그인 비밀값(2단계 인증 키·푸시 토큰·부모 동의 토큰)은 빼고, 아티스트 메시지는 팬 본인이 쓴 게 아니라 뺌.
 */
@Injectable()
export class PrivacyExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async build(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        displayName: true,
        nickname: true,
        email: true,
        locale: true,
        countryCode: true,
        birthDate: true,
        parentEmail: true,
        statusMessage: true,
        profileImageUrl: true,
        status: true,
        suspendedUntil: true,
        bannedAt: true,
        sanctionCategory: true,
        termsVersion: true,
        termsAcceptedAt: true,
        replyRulesAcceptedAt: true,
        notifyArtistMessages: true,
        notifyIdleAlerts: true,
        autoTranslate: true,
        birthdayGreetingsEnabled: true,
        signupPlatform: true,
        lastActiveAt: true,
        createdAt: true,
        authIdentities: { select: { provider: true, createdAt: true } },
        pushDevices: { select: { platform: true, createdAt: true, updatedAt: true } },
      },
    });
    const [subscriptions, purchases, charges, refunds, replies, reports, blocks, birthdayGreetings, releaseWatches, storyViews, inquiries, accessLogs] = await Promise.all([
      this.prisma.subscription.findMany({ where: { userId }, orderBy: { startedAt: 'asc' }, select: { startedAt: true, cancelledAt: true, actor: { select: { chatDisplayName: true } } } }),
      this.prisma.purchase.findMany({
        where: { userId },
        orderBy: { startedAt: 'asc' },
        select: { priceCents: true, startedAt: true, cancelledAt: true, iapPlatform: true, iapExpiresAt: true, willRenew: true, actor: { select: { chatDisplayName: true } }, bundle: { select: { name: true } } },
      }),
      this.prisma.purchaseCharge.findMany({
        where: { purchase: { userId } },
        orderBy: { chargedAt: 'asc' },
        select: { productName: true, amountCents: true, chargedAt: true, periodEnd: true, source: true, refundedAt: true, storeAmountMilli: true, storeCurrency: true },
      }),
      this.prisma.refundRequest.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { reason: true, status: true, source: true, createdAt: true } }),
      this.prisma.message.findMany({
        where: { fanUserId: userId, senderType: 'FAN' },
        orderBy: { createdAt: 'asc' },
        select: { body: true, mediaType: true, createdAt: true, deletedAt: true, actor: { select: { chatDisplayName: true } } },
      }),
      this.prisma.report.findMany({ where: { reportedById: userId }, orderBy: { createdAt: 'asc' }, select: { category: true, reason: true, status: true, createdAt: true } }),
      this.prisma.actorFanBlock.findMany({ where: { fanUserId: userId }, select: { reason: true, createdAt: true, actor: { select: { chatDisplayName: true } } } }),
      this.prisma.birthdayGreeting.findMany({ where: { userId }, select: { body: true, year: true, createdAt: true, actor: { select: { chatDisplayName: true } } } }),
      this.prisma.releaseWatch.findMany({ where: { userId }, select: { createdAt: true, actor: { select: { chatDisplayName: true } }, bundle: { select: { name: true } } } }),
      this.prisma.storyView.count({ where: { fanUserId: userId } }),
      this.prisma.supportInquiry.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { category: true, title: true, status: true, createdAt: true, messages: { orderBy: { createdAt: 'asc' }, select: { fromAdmin: true, body: true, createdAt: true } } },
      }),
      this.prisma.accessLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { kind: true, platform: true, deviceModel: true, osVersion: true, appVersion: true, ip: true, createdAt: true },
      }),
    ]);
    const { authIdentities, pushDevices, profileImageUrl, ...profile } = user;
    return {
      exportedAt: new Date().toISOString(),
      profile: { ...profile, profileImageUrl: await this.media.resolveImageUrl(profileImageUrl), loginProviders: authIdentities, pushDevices },
      subscriptions,
      purchases,
      charges,
      refunds,
      replies,
      reportsFiled: reports,
      blockedInRooms: blocks,
      birthdayGreetings,
      releaseWatches,
      storyViewsCount: storyViews,
      supportInquiries: inquiries,
      accessLogs,
    };
  }
}
