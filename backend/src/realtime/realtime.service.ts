import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';

const CHANNEL = 'toffee_realtime';

/**
 * 앱에 "이 채팅방이 바뀌었어요"만 알리는 신호 — 내용은 싣지 않음(앱이 받으면 평소 API로 다시 불러옴).
 * - artist-message: 스타가 새 메시지를 보냄 → 그 배우 구독 팬·스타·소속사
 * - message-removed: 스타가 지웠거나 운영자가 가림 → 같은 대상
 * - fan-reply: 팬 답장 → 스타·소속사만(팬 답장은 다른 팬에게 안 보임)
 * - resync: 이 서버의 LISTEN 연결이 끊겼다 다시 붙음 → 그 사이 신호를 놓쳤을 수 있으니 이 서버에 붙은 모든 연결에
 *   "전부 다시 불러오기"(2026-10-25). DB를 거치지 않는 서버 안 신호라 다른 서버엔 안 감
 */
export interface RealtimeEvent {
  kind: 'artist-message' | 'message-removed' | 'fan-reply' | 'access-changed' | 'resync';
  /** access-changed엔 없음(사람 단위 신호) */
  actorId?: string;
  /** fan-reply: 답장이 달린 스타 메시지 */
  messageId?: string;
  /** access-changed: 구독이 바뀐 사람 — 그 사람 연결만 볼 수 있는 방 목록을 다시 읽음(2026-09-29 부하 테스트 후) */
  userId?: string;
}

/**
 * 서버가 여러 대여도 모든 서버가 같은 신호를 받도록 Postgres의 LISTEN/NOTIFY를 씀 — Redis 같은 추가 서비스 없이
 * 어느 호스팅에서나 동작(2026-09-29). 서버마다 DB 연결 하나를 LISTEN 전용으로 열어 두고, 보낼 땐 pg_notify.
 * 이 연결이 끊겨도 앱은 짧은 폴링으로 돌아가므로 기능이 멈추지는 않음(재연결은 자동).
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subject = new Subject<RealtimeEvent>();
  readonly events$ = this.subject.asObservable();
  // 배포 때 SSE 연결만 먼저 닫기(2026-10-25) — LISTEN은 하던 요청이 끝날 때까지 유지(그 요청들이 보내는 신호는 다른 서버로도 감)
  private readonly streamsClosed = new Subject<void>();
  readonly streamsClosed$ = this.streamsClosed.asObservable();
  private streamsOpen = true;
  private listenedOnce = false;
  private client: pg.Client | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryDelay = 1000;
  private closed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.listen();
  }

  /** 실시간 연결을 받는 중인지 — 끄기 시작하면 false(새 연결은 거절, 앱은 다른 서버로 다시 붙음) */
  get acceptingStreams(): boolean {
    return this.streamsOpen;
  }

  /** 지금 열린 SSE 연결을 모두 닫음(배포 시작) — 앱은 끊김을 보고 바로 다시 연결(새 서버로) */
  closeStreams() {
    if (!this.streamsOpen) return;
    this.streamsOpen = false;
    this.streamsClosed.next();
    this.streamsClosed.complete();
  }

  async onModuleDestroy() {
    this.closeStreams();
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.subject.complete();
    await this.client?.end().catch(() => {});
  }

  /** 신호 보내기 — 실패해도 원래 작업(메시지 저장 등)은 성공으로 둠(앱은 폴링으로도 받음) */
  async publish(event: RealtimeEvent): Promise<void> {
    try {
      await this.prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
    } catch (error) {
      this.logger.warn(`publish failed: ${(error as Error).message}`);
    }
  }

  private async listen() {
    if (this.closed) return;
    const client = new pg.Client({ connectionString: this.config.getOrThrow<string>('DATABASE_URL') });
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        this.subject.next(JSON.parse(msg.payload) as RealtimeEvent);
      } catch {
        // 잘못된 신호는 무시
      }
    });
    client.on('error', (error) => {
      this.logger.warn(`listener error: ${error.message}`);
      this.reconnect(client);
    });
    client.on('end', () => this.reconnect(client));
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
      this.retryDelay = 1000;
      // 다시 붙은 경우: 끊겨 있던 동안의 신호는 영영 안 옴 — 앱이 지금 보는 목록을 전부 다시 불러오게(2026-10-25. 예전엔
      // 앱이 연결돼 있다고 믿고 30초 폴링만 해서, 그 사이 메시지가 최대 30초 늦게 보였음)
      if (this.listenedOnce) this.subject.next({ kind: 'resync' });
      this.listenedOnce = true;
    } catch (error) {
      this.logger.warn(`listener connect failed: ${(error as Error).message}`);
      this.reconnect(client);
    }
  }

  private reconnect(client: pg.Client) {
    if (this.closed || this.retryTimer || (this.client && this.client !== client)) return;
    this.client = null;
    client.removeAllListeners();
    void client.end().catch(() => {});
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.listen();
    }, delay);
  }
}
