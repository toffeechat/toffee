import { Controller, Header, MessageEvent, ServiceUnavailableException, Sse } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
import { viewableActorsWhere } from '../common/authorization/actor-access.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { RealtimeService, type RealtimeEvent } from './realtime.service.js';
import { tokenSessionValid } from '../auth/auth-sessions.js';

// 연결을 유지하려고 보내는 빈 신호 간격(중간 프록시가 조용한 연결을 끊지 않게)
const HEARTBEAT_MS = 25_000;
// 볼 수 있는 배우 목록 안전 새로고침 간격 — 구독이 바뀌면 access-changed 신호로 바로 다시 읽으므로 이건 역할·소속 변경 같은
// 드문 경우용. 예전엔 1분마다라 연결 3,000개면 DB 조회가 끊임없었음(2026-09-29 부하 테스트). 연결마다 시점을 흩뜨림
const AUDIENCE_REFRESH_MS = 10 * 60_000;
// 한 계정이 이 서버에 동시에 열 수 있는 연결 수 — 넘으면 가장 오래된 것을 닫음(2026-10-27, 토큰 하나로 연결을 무한정 여는 것 방지)
export const MAX_STREAMS_PER_USER = 5;

interface Audience {
  admin: boolean;
  /** 구독 중인 배우(팬) */
  subscribed: Set<string>;
  /** 배우 본인·소속사 직원으로 볼 수 있는 배우 */
  staff: Set<string>;
}

@Controller('realtime')
export class RealtimeController {
  // 계정별 열린 연결(열린 순서) — 닫는 함수
  private readonly streams = new Map<string, (() => void)[]>();

  constructor(
    private readonly realtime: RealtimeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 앱이 로그인한 동안 열어 두는 연결(SSE) — 이 계정이 볼 수 있는 채팅방의 변경 신호만 흘려보냄.
   * 한 번 연결에 요청 하나라 요청 횟수 제한에서는 뺌.
   */
  @SkipThrottle()
  @Sse()
  @Header('X-Accel-Buffering', 'no')
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    // 끄는 중인 서버엔 새로 붙지 않게 — 앱은 재시도하면서 새 서버로 붙음(2026-10-25)
    if (!this.realtime.acceptingStreams) throw new ServiceUnavailableException();
    return new Observable<MessageEvent>((subscriber) => {
      let audience: Audience | null = null;
      // 연결 중에 정지·영구 정지·탈퇴됐으면 다음 새로고침 때 닫음(2026-10-27 — 예전엔 연결할 때만 확인해서 계속 신호를 받았음)
      // 로그아웃·모든 기기 로그아웃으로 이 토큰이 끊겨도 닫음(같은 날 로그인 세션)
      const refresh = () =>
        this.loadAudience(user)
          .then((next) => {
            if (!next) subscriber.complete();
            else audience = next;
          })
          .catch(() => {});
      const close = () => subscriber.complete();
      const mine = this.streams.get(user.id) ?? [];
      mine.push(close);
      this.streams.set(user.id, mine);
      while (mine.length > MAX_STREAMS_PER_USER) mine.shift()!();
      // 볼 수 있는 방 목록을 다 읽은 뒤에 "준비됨" — 예전엔 먼저 보내서, 읽는 사이에 온 신호가 조용히 버려질 수 있었음
      void refresh().then(() => {
        if (!subscriber.closed) subscriber.next({ type: 'ready', data: '' });
      });
      const refreshTimer = setInterval(() => void refresh(), AUDIENCE_REFRESH_MS + Math.floor(Math.random() * 60_000));
      const heartbeat = setInterval(() => subscriber.next({ type: 'ping', data: '' }), HEARTBEAT_MS);
      const subscription = this.realtime.events$.subscribe({
        next: (event) => {
          // 이 서버가 신호를 놓쳤을 수 있음(LISTEN 재연결) — 모두에게 "전부 다시 불러오기"
          if (event.kind === 'resync') {
            subscriber.next({ type: 'change', data: event });
            return;
          }
          if (event.kind === 'access-changed') {
            // 내 구독이 바뀜 — 방 목록을 다시 읽고 앱에도 알려 줌(인박스·구독 관리 새로고침)
            if (event.userId === user.id) void refresh().then(() => subscriber.next({ type: 'change', data: event }));
            return;
          }
          if (audience && canReceive(audience, event)) subscriber.next({ type: 'change', data: event });
        },
        // 서버가 꺼질 때(배포·재시작) 연결을 닫아 줌 — 앱은 알아서 다른 서버로 다시 연결
        complete: () => subscriber.complete(),
      });
      // 배포 시작 — 하던 요청은 마저 처리하지만 실시간 연결은 먼저 닫아서 앱이 새 서버로 옮겨 가게(2026-10-25)
      const closing = this.realtime.streamsClosed$.subscribe({ complete: () => subscriber.complete() });
      return () => {
        const list = this.streams.get(user.id);
        if (list) {
          const index = list.indexOf(close);
          if (index >= 0) list.splice(index, 1);
          if (list.length === 0) this.streams.delete(user.id);
        }
        clearInterval(refreshTimer);
        clearInterval(heartbeat);
        subscription.unsubscribe();
        closing.unsubscribe();
      };
    });
  }

  /** 볼 수 있는 방 목록 — 계정이 더 이상 쓸 수 없거나(없음·영구 정지·탈퇴·정지 기간 중) 토큰이 끊겼으면 null(연결을 닫음, 로그인 확인과 같은 기준) */
  private async loadAudience(auth: AuthenticatedUser): Promise<Audience | null> {
    const userId = auth.id;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        agencyId: true,
        status: true,
        deletedAt: true,
        suspendedUntil: true,
        tokenVersion: true,
        authSessions: { where: { id: auth.sessionId ?? '' }, select: { revokedAt: true, expiresAt: true } },
      },
    });
    if (!user || !accountUsable(user) || !tokenSessionValid(auth, user)) return null;
    if (user.role === Role.ADMIN) return { admin: true, subscribed: new Set(), staff: new Set() };
    const [subscriptions, actors] = await Promise.all([
      this.prisma.subscription.findMany({ where: { userId, cancelledAt: null }, select: { actorId: true } }),
      user.role === Role.ACTOR || user.role === Role.AGENCY_STAFF
        ? this.prisma.actor.findMany({ where: viewableActorsWhere(user), select: { id: true } })
        : Promise.resolve([]),
    ]);
    return {
      admin: false,
      subscribed: new Set(subscriptions.map((sub) => sub.actorId)),
      staff: new Set(actors.map((actor) => actor.id)),
    };
  }
}

export function accountUsable(user: { status: UserStatus; deletedAt: Date | null; suspendedUntil: Date | null }, now = new Date()): boolean {
  if (user.status === UserStatus.BANNED || user.deletedAt) return false;
  return !(user.status === UserStatus.SUSPENDED && user.suspendedUntil && user.suspendedUntil > now);
}

export function canReceive(audience: Audience, event: RealtimeEvent): boolean {
  if (!event.actorId) return false;
  if (audience.admin || audience.staff.has(event.actorId)) return true;
  return event.kind !== 'fan-reply' && audience.subscribed.has(event.actorId);
}
