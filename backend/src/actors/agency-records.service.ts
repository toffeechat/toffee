import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { fanTag } from '../common/nickname/nickname.js';
import { appError } from '../common/i18n/app-error.js';
import { MessageSenderType, Role } from '../generated/prisma/enums.js';
import { ActorsService } from './actors.service.js';

// 목록마다 최근 것부터 이만큼(넘으면 아티스트로 좁혀 보기)
const RECORDS_LIMIT = 200;

/**
 * 소속사 "기록"(2026-10-13 사용자 요청) — 소속 아티스트 방에서 일어난 차단·신고·메시지 삭제를 한곳에서. 범위는 "우리 아티스트 방에서
 * 일어난 것만"(사용자 결정): 운영자의 서비스 전체 제재나 다른 소속사 방 일은 안 보임. 신고는 우리 쪽(아티스트·소속사)이 한 것만 —
 * 팬이 아티스트 메시지를 신고한 건 운영자 대기열 몫. 누가 했는지는 역할(아티스트/소속사/운영자)과 "나"까지만(동료 실명은 안 보여 줌).
 */
@Injectable()
export class AgencyRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorsService,
  ) {}

  async records(userId: string, actorId?: string) {
    const actors = await this.actors.findMine(userId);
    let ids = actors.map((actor) => actor.id);
    if (actorId) {
      if (!ids.includes(actorId)) throw new ForbiddenException(appError('ACTOR_STAFF_OR_SELF_ONLY'));
      ids = [actorId];
    }
    const room = new Map(actors.map((actor) => [actor.id, { id: actor.id, chatDisplayName: actor.chatDisplayName, kind: actor.kind }]));
    const fan = (user: { id: string; nickname: string | null } | null) => (user ? { id: user.id, nickname: user.nickname, tag: fanTag(user.id) } : null);

    const [blocks, reports, deleted] = await Promise.all([
      this.prisma.actorFanBlock.findMany({
        where: { actorId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        take: RECORDS_LIMIT,
        select: {
          actorId: true,
          createdAt: true,
          reason: true,
          blockedById: true,
          blockedBy: { select: { role: true } },
          fanUser: { select: { id: true, nickname: true } },
          message: { select: { id: true, body: true, createdAt: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { message: { actorId: { in: ids } }, reportedBy: { role: { in: [Role.ACTOR, Role.AGENCY_STAFF] } } },
        orderBy: { createdAt: 'desc' },
        take: RECORDS_LIMIT,
        select: {
          id: true,
          category: true,
          reason: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          reportedById: true,
          reportedBy: { select: { role: true } },
          message: { select: { id: true, actorId: true, body: true, mediaType: true, senderType: true, createdAt: true, fanUser: { select: { id: true, nickname: true } } } },
        },
      }),
      this.prisma.message.findMany({
        where: { actorId: { in: ids }, senderType: MessageSenderType.ARTIST, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        take: RECORDS_LIMIT,
        select: { id: true, actorId: true, body: true, mediaType: true, createdAt: true, deletedAt: true, deletedByAdmin: true, deletedByStaffId: true, deletedReason: true },
      }),
    ]);

    // 소속사가 지운 건 어느 직원인지 이름까지(2026-10-25 — 같은 소속사 안에서만 보이는 기록이라). 운영자는 개인 대신 "운영자"
    const staffIds = [...new Set(deleted.map((message) => message.deletedByStaffId).filter((id): id is string => !!id))];
    const staff = new Map(
      (staffIds.length ? await this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, displayName: true } }) : []).map(
        (user) => [user.id, user.displayName] as const,
      ),
    );

    return {
      limit: RECORDS_LIMIT,
      blocks: blocks.map((block) => ({
        room: room.get(block.actorId) ?? null,
        createdAt: block.createdAt,
        reason: block.reason,
        by: block.blockedBy.role,
        byMe: block.blockedById === userId,
        fanUser: fan(block.fanUser),
        message: block.message,
      })),
      reports: reports.map((report) => ({
        id: report.id,
        room: room.get(report.message.actorId) ?? null,
        category: report.category,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
        resolvedAt: report.resolvedAt,
        by: report.reportedBy.role,
        byMe: report.reportedById === userId,
        message: {
          id: report.message.id,
          body: report.message.body,
          mediaType: report.message.mediaType,
          senderType: report.message.senderType,
          createdAt: report.message.createdAt,
          fanUser: fan(report.message.fanUser),
        },
      })),
      deleted: deleted.map((message) => ({
        id: message.id,
        room: room.get(message.actorId) ?? null,
        body: message.body,
        mediaType: message.mediaType,
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
        // 운영자가 숨김 / 소속사가 삭제 / 아티스트가 삭제(보내기 취소)
        by: message.deletedByAdmin ? Role.ADMIN : message.deletedByStaffId ? Role.AGENCY_STAFF : Role.ACTOR,
        byMe: message.deletedByStaffId === userId,
        byName: message.deletedByStaffId ? (staff.get(message.deletedByStaffId) ?? null) : null,
        // 운영자·소속사가 지울 때 받은 사유(2026-10-25부터 필수, 그 전 기록·아티스트 본인 회수는 null)
        reason: message.deletedReason,
      })),
    };
  }
}
