import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export type AdminActionType =
  | 'USER_SUSPEND'
  | 'USER_BAN'
  | 'USER_REACTIVATE'
  | 'USER_PROFILE_CLEAR'
  | 'USER_ROLE'
  | 'REPORT_RESOLVE'
  | 'REPORT_DISMISS'
  | 'ACTOR_RETIRE'
  | 'ACTOR_RESTORE'
  // 가격·스토어 상품 변경(돈과 직결돼서 기록, 2026-09-29)
  | 'ACTOR_PRICE'
  | 'BUNDLE_CREATE'
  | 'BUNDLE_UPDATE'
  | 'COUPLE_CREATE'
  // 소속사 정산 배분율 변경(2026-09-29)
  | 'AGENCY_SHARE'
  // 정산 마감·마감 취소(2026-09-29)
  | 'SETTLEMENT_CLOSE'
  | 'SETTLEMENT_REOPEN'
  // 정산 지급 기록·기록 삭제(2026-09-29)
  | 'SETTLEMENT_PAYOUT'
  | 'SETTLEMENT_PAYOUT_DELETE'
  // 공지사항 쓰기·고치기·지우기(2026-10-12)
  | 'NOTICE_CREATE'
  | 'NOTICE_UPDATE'
  | 'NOTICE_DELETE'
  // 아티스트 일괄 등록·공개 시각 변경·계정 연결 링크 발급/취소(운영자)·링크로 연결(아티스트 본인이 adminId 자리에, 2026-10-19)
  | 'ACTOR_IMPORT'
  | 'ACTOR_RELEASE'
  | 'ACTOR_LINK_ISSUE'
  | 'ACTOR_LINK_REVOKE'
  | 'ACTOR_LINK_CLAIM'
  // 금칙어 추가·삭제·기본 목록 넣기, 활동 종료 예정 정하기(2026-10-20)
  | 'BANNED_WORD_CREATE'
  | 'BANNED_WORD_DELETE'
  | 'BANNED_WORD_DEFAULTS'
  | 'ACTOR_RETIRE_SCHEDULE'
  // 운영 기능(2026-10-20) — 애플 판매 중지 표시, 계약 종료일, 앱 설정(점검·최소 버전), 공지 푸시, 문의 답변·닫기, 운영자 권한·2단계 인증, 개인정보 내보내기
  | 'STORE_SALE_STOPPED'
  | 'ACTOR_CONTRACT'
  | 'APP_SETTINGS'
  | 'NOTICE_PUSH'
  | 'INQUIRY_REPLY'
  | 'INQUIRY_CLOSE'
  | 'ADMIN_LEVEL'
  | 'ADMIN_MFA'
  | 'USER_EXPORT'
  // 환불 처리 대기 "확인함"(2026-10-22)
  | 'REFUND_CHECK';

/**
 * 운영자 작업 기록(AdminAction) — 제재·역할 변경·신고 처리·배우 활동 종료를 누가 언제 했는지. 유료 서비스 분쟁·문의 대응용.
 * 기록 실패가 본 작업을 막지 않게 호출하는 쪽은 await만 하고, 여기서 오류는 삼키지 않음(트랜잭션 밖 기록이라 드묾).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(adminId: string, action: AdminActionType, targetType: 'USER' | 'REPORT' | 'ACTOR' | 'BUNDLE' | 'AGENCY' | 'SETTLEMENT' | 'NOTICE' | 'BANNED_WORD' | 'APP' | 'INQUIRY' | 'REFUND', targetId: string, detail?: Prisma.InputJsonValue) {
    await this.prisma.adminAction.create({ data: { adminId, action, targetType, targetId, detail } });
  }

  /** 최근 기록(운영자 화면) — 누가·무엇을·대상 이름까지 한 번에 */
  async recent(limit = 100) {
    const actions = await this.prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { displayName: true } } },
    });
    const userIds = actions.filter((a) => a.targetType === 'USER').map((a) => a.targetId);
    const actorIds = actions.filter((a) => a.targetType === 'ACTOR').map((a) => a.targetId);
    const bundleIds = actions.filter((a) => a.targetType === 'BUNDLE').map((a) => a.targetId);
    const agencyIds = actions.filter((a) => a.targetType === 'AGENCY').map((a) => a.targetId);
    // 1:1 문의·공지는 제목으로(2026-10-20 — 예전엔 id가 그대로 보였음)
    const inquiryIds = actions.filter((a) => a.targetType === 'INQUIRY').map((a) => a.targetId);
    const noticeIds = actions.filter((a) => a.targetType === 'NOTICE').map((a) => a.targetId);
    const [users, actors, bundles, agencies, inquiries, notices] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nickname: true, displayName: true, email: true } }),
      this.prisma.actor.findMany({ where: { id: { in: actorIds } }, select: { id: true, legalName: true } }),
      this.prisma.bundle.findMany({ where: { id: { in: bundleIds } }, select: { id: true, name: true } }),
      this.prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } }),
      this.prisma.supportInquiry.findMany({ where: { id: { in: inquiryIds } }, select: { id: true, title: true } }),
      this.prisma.notice.findMany({ where: { id: { in: noticeIds } }, select: { id: true, title: true } }),
    ]);
    const names = new Map<string, string>([
      ...users.map((u) => [u.id, u.nickname ?? u.displayName ?? u.email ?? u.id] as [string, string]),
      ...actors.map((a) => [a.id, a.legalName] as [string, string]),
      ...bundles.map((b) => [b.id, b.name] as [string, string]),
      ...agencies.map((a) => [a.id, a.name] as [string, string]),
      ...inquiries.map((i) => [i.id, i.title] as [string, string]),
      ...notices.map((n) => [n.id, n.title] as [string, string]),
    ]);
    return actions.map(({ admin, ...action }) => ({ ...action, adminName: admin.displayName, targetName: names.get(action.targetId) ?? null }));
  }
}
