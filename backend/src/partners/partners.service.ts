import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ActorKind, UserStatus } from '../generated/prisma/enums.js';
import { appError } from '../common/i18n/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { authenticateClient, findClient, pkceChallenge, type PartnerClient } from './partner-clients.js';
import { summarize } from './partner-subscriptions.js';

const CODE_TTL_MS = 60_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * 디저트랩 다른 서비스(검볼)에 "토피로 로그인"(2026-10-28) — OAuth 2.0 인가 코드 + PKCE(S256)를 최소한으로.
 * 1) 검볼이 토피 웹 /connect/<client_id>로 보냄 → 로그인한 팬이 동의 → 서버가 1회용 코드(60초)를 만들고 검볼 주소로 돌려보냄
 * 2) 검볼 서버가 코드 + 비밀값 + code_verifier로 교환 → 그 서비스용 무작위 id(sub)·닉네임·이메일
 * 3) 검볼 서버가 sub로 아티스트 구독 요약을 물음 — 팬이 연결을 끊으면(설정) 바로 막힘
 * 토피 userId·결제 내역은 넘기지 않음. 동의·해제 기록은 PartnerLink(consentedAt·revokedAt)에 남음.
 */
@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  private client(clientId: string, redirectUri: string): PartnerClient {
    const client = findClient(clientId);
    if (!client || !client.redirectUris.includes(redirectUri)) throw new BadRequestException(appError('PARTNER_INVALID_REQUEST'));
    return client;
  }

  /** 동의 화면 — 어느 서비스인지, 이미 연결했는지 */
  async preview(userId: string, clientId: string, redirectUri: string) {
    const client = this.client(clientId, redirectUri);
    const link = await this.prisma.partnerLink.findUnique({ where: { userId_partner: { userId, partner: client.partner } }, select: { revokedAt: true } });
    return { partner: client.partner, name: client.name, linked: !!link && !link.revokedAt };
  }

  /** 동의 → 1회용 코드. 돌아갈 주소(코드·state 붙임)를 돌려줌 */
  async authorize(userId: string, input: { clientId: string; redirectUri: string; state: string; codeChallenge: string }) {
    const client = this.client(input.clientId, input.redirectUri);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new ForbiddenException(appError('PARTNER_INVALID_REQUEST'));
    const code = randomBytes(32).toString('base64url');
    const codeData = { codeHash: hash(code), codeExpiresAt: new Date(Date.now() + CODE_TTL_MS), codeChallenge: input.codeChallenge, codeRedirectUri: input.redirectUri };
    const existing = await this.prisma.partnerLink.findUnique({ where: { userId_partner: { userId, partner: client.partner } }, select: { id: true, revokedAt: true } });
    if (existing) {
      // 끊었다가 다시 연결하면 새 sub — 예전 연결과 이어지지 않게
      await this.prisma.partnerLink.update({
        where: { id: existing.id },
        data: { ...codeData, ...(existing.revokedAt ? { sub: randomUUID(), revokedAt: null, consentedAt: new Date() } : {}) },
      });
    } else {
      await this.prisma.partnerLink.create({ data: { userId, partner: client.partner, sub: randomUUID(), ...codeData } });
    }
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', input.state);
    return { redirectTo: url.toString() };
  }

  /** 서비스 서버: 코드 교환 */
  async token(input: { clientId?: string; clientSecret?: string; code: string; codeVerifier: string; redirectUri: string }) {
    const client = authenticateClient(input.clientId, input.clientSecret);
    if (!client) throw new UnauthorizedException({ code: 'INVALID_CLIENT' });
    const link = await this.prisma.partnerLink.findUnique({
      where: { codeHash: hash(input.code) },
      include: { user: { select: { nickname: true, displayName: true, email: true, locale: true, status: true } } },
    });
    const valid =
      !!link &&
      link.partner === client.partner &&
      !link.revokedAt &&
      !!link.codeExpiresAt &&
      link.codeExpiresAt > new Date() &&
      link.codeRedirectUri === input.redirectUri &&
      link.codeChallenge === pkceChallenge(input.codeVerifier);
    // 맞든 틀리든 코드는 한 번 보면 끝
    if (link) await this.prisma.partnerLink.update({ where: { id: link.id }, data: { codeHash: null, codeExpiresAt: null, codeChallenge: null, codeRedirectUri: null } });
    if (!valid || link.user.status !== UserStatus.ACTIVE) throw new BadRequestException({ code: 'INVALID_GRANT' });
    await this.prisma.partnerLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    return { sub: link.sub, nickname: link.user.nickname ?? null, email: link.user.email ?? null, locale: link.user.locale ?? null };
  }

  /** 서비스 서버: 아티스트별 구독 요약(최대 20명). 연결이 끊겼으면 LINK_REVOKED */
  async subscriptions(input: { clientId?: string; clientSecret?: string; sub: string; artistIds: string[] }, now = new Date()) {
    const client = authenticateClient(input.clientId, input.clientSecret);
    if (!client) throw new UnauthorizedException({ code: 'INVALID_CLIENT' });
    const link = await this.prisma.partnerLink.findUnique({ where: { sub: input.sub }, select: { id: true, userId: true, partner: true, revokedAt: true, user: { select: { status: true } } } });
    if (!link || link.partner !== client.partner || link.revokedAt) throw new NotFoundException({ code: 'LINK_REVOKED' });
    const artistIds = [...new Set(input.artistIds)];
    // 커플방 — 이 아티스트가 멤버인 방도 같이 봄
    const couples = await this.prisma.coupleMember.findMany({ where: { memberId: { in: artistIds }, couple: { kind: ActorKind.COUPLE } }, select: { coupleId: true, memberId: true } });
    const roomsOf = new Map(artistIds.map((id) => [id, [id, ...couples.filter((c) => c.memberId === id).map((c) => c.coupleId)]]));
    const banned = link.user.status !== UserStatus.ACTIVE;
    const open = banned
      ? []
      : await this.prisma.subscription.findMany({
          where: { userId: link.userId, cancelledAt: null, actorId: { in: [...new Set([...roomsOf.values()].flat())] } },
          select: { actorId: true, startedAt: true },
        });
    await this.prisma.partnerLink.update({ where: { id: link.id }, data: { lastUsedAt: now } });
    return {
      artists: Object.fromEntries(artistIds.map((id) => [id, summarize(open.filter((s) => roomsOf.get(id)!.includes(s.actorId)), now)])),
    };
  }

  /** 서비스 서버: 그 서비스에서 팬이 연결을 끊음 — 토피 쪽 연결도 끊음(다시 연결하면 새 sub) */
  async revokeFromPartner(input: { clientId?: string; clientSecret?: string; sub: string }) {
    const client = authenticateClient(input.clientId, input.clientSecret);
    if (!client) throw new UnauthorizedException({ code: 'INVALID_CLIENT' });
    const { count } = await this.prisma.partnerLink.updateMany({
      where: { sub: input.sub, partner: client.partner, revokedAt: null },
      data: { revokedAt: new Date(), codeHash: null, codeExpiresAt: null, codeChallenge: null, codeRedirectUri: null },
    });
    return { ok: count > 0 };
  }

  /** 팬 설정 — 연결된 서비스 */
  async myLinks(userId: string) {
    const links = await this.prisma.partnerLink.findMany({ where: { userId, revokedAt: null }, select: { partner: true, consentedAt: true, lastUsedAt: true } });
    return links.map((l) => ({ ...l, name: l.partner === 'gumball' ? 'Gumball' : l.partner }));
  }

  async revoke(userId: string, partner: string) {
    const { count } = await this.prisma.partnerLink.updateMany({
      where: { userId, partner, revokedAt: null },
      data: { revokedAt: new Date(), codeHash: null, codeExpiresAt: null, codeChallenge: null, codeRedirectUri: null },
    });
    return { ok: count > 0 };
  }
}
