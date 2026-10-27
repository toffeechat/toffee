import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { MessagesService, toQuote } from './messages.service.js';
import { MessageMediaType, MessageSenderType, Role, UserStatus } from '../generated/prisma/enums.js';
import type { ComposePush } from '../notifications/push.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PushService } from '../notifications/push.service.js';
import type { ModerationService } from '../moderation/moderation.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { ConfigService } from '@nestjs/config';
import type { RealtimeService } from '../realtime/realtime.service.js';

const realtime = { publish: vi.fn().mockResolvedValue(undefined) } as unknown as RealtimeService;

const config = (values: Record<string, string> = {}) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

// sendBroadcast의 푸시 문구 조립만 검증 — DB/FCM은 가짜로 대체
function setup() {
  const fanPushes: ComposePush[] = [];
  const staffPushes: ComposePush[] = [];
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: Role.ADMIN }) },
    message: { create: vi.fn().mockResolvedValue({ id: 'm1', mediaKey: null, mediaUrl: null }) },
    subscription: {
      findMany: vi.fn().mockResolvedValue([{ userId: 'fan-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    actor: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ chatDisplayName: '캐러멜', kind: 'SOLO', welcomeMessage: '환영', birthdayMessage: '축하' }),
      // 보낸 사람 확인(1인 방, 운영자 계정) · 보낸 배우 이름 조회
      findUnique: vi.fn().mockResolvedValue({ kind: 'SOLO', selfUserId: 'star', coupleMembers: [] }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
  const push = {
    sendToUser: vi.fn().mockResolvedValue(undefined),
    sendToUsers: vi.fn((_userIds: string[], compose: ComposePush) => {
      fanPushes.push(compose);
      return Promise.resolve();
    }),
    notifyActorStaff: vi.fn((_actorId: string, compose: ComposePush) => {
      staffPushes.push(compose);
      return Promise.resolve();
    }),
  } as unknown as PushService;
  const media = {
    verifyForAttach: vi.fn().mockResolvedValue(undefined),
    withReadUrl: vi.fn((item: object) => Promise.resolve(item)),
    resolveImageUrl: vi.fn((value: string | null) => Promise.resolve(value)),
  } as unknown as MediaService;
  const service = new MessagesService(prisma, push, {} as ModerationService, media, config(), realtime);
  return { service, fanPushes, staffPushes, prisma, push };
}

describe('MessagesService.sendBroadcast 푸시 문구', () => {
  it('팬 푸시: 제목은 대화방 이름, {{name}}은 받는 팬 이름으로 치환', async () => {
    const { service, fanPushes, staffPushes } = setup();
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '{{name}}야 안녕!' });

    expect(fanPushes[0]({ locale: 'ko', displayName: '민지' })).toEqual({ title: '캐러멜', body: '민지야 안녕!' });
    // 모니터링용 스태프 알림은 원문 그대로, 카톡처럼 제목은 아티스트 이름(2026-10-14)
    expect(staffPushes[0]({ locale: 'en', displayName: 'staff' })).toEqual({ title: '캐러멜', body: '{{name}}야 안녕!' });
  });

  it('CP방: 보낸 아티스트가 기록되고, 팬 알림은 "방 이름" 제목 + "보낸 아티스트: 내용"', async () => {
    const { service, fanPushes, prisma } = setup();
    const actor = (prisma as unknown as { actor: Record<string, ReturnType<typeof vi.fn>> }).actor;
    (prisma as unknown as { user: { findUniqueOrThrow: ReturnType<typeof vi.fn> } }).user.findUniqueOrThrow.mockResolvedValue({ role: Role.ACTOR });
    actor.findUnique.mockResolvedValue({
      kind: 'COUPLE',
      selfUserId: null,
      coupleMembers: [{ member: { id: 'nawin', selfUserId: 'u-nawin' } }, { member: { id: 'pakin', selfUserId: 'u-pakin' } }],
    });
    actor.findUniqueOrThrow.mockResolvedValue({ chatDisplayName: 'Nawin & Pakin', kind: 'COUPLE', welcomeMessage: '환영', birthdayMessage: '축하' });
    actor.findMany.mockResolvedValue([{ id: 'pakin', chatDisplayName: 'Pakin', chatProfileImageUrl: null }]);
    (prisma as unknown as { message: { create: ReturnType<typeof vi.fn> } }).message.create.mockResolvedValue({
      id: 'm1',
      mediaKey: null,
      mediaUrl: null,
      senderActorId: 'pakin',
    });

    await service.sendBroadcast('u-pakin', 'couple-1', { mediaType: MessageMediaType.TEXT, body: '같이 인사해요' });

    expect((prisma as unknown as { message: { create: ReturnType<typeof vi.fn> } }).message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ senderActorId: 'pakin' }) }),
    );
    expect(fanPushes[0]({ locale: 'ko', displayName: '민지' })).toEqual({ title: 'Nawin & Pakin', body: 'Pakin: 같이 인사해요' });
  });

  it('알림을 끈 팬(notificationsMuted)은 푸시 대상에서 빠짐', async () => {
    const { service, prisma } = setup();
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕' });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ notificationsMuted: false, cancelledAt: null }) }),
    );
  });

  it('본문 없는 미디어는 받는 사람 언어의 안내 문구로', async () => {
    const { service, fanPushes } = setup();
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.PHOTO, mediaKey: 'actors/actor-1/message/a.jpg' });

    expect(fanPushes[0]({ locale: 'th', displayName: 'fan' }).body).toBe('ส่งรูปภาพ');
    expect(fanPushes[0]({ locale: null, displayName: 'fan' }).body).toBe('Sent a photo');
  });

  it('알림 data에 보낸 사람 이름·프로필 사진(아이폰 대화 알림용) — 팬·소속사 모두(2026-10-14)', async () => {
    const { service, prisma, push } = setup();
    const actor = (prisma as unknown as { actor: Record<string, ReturnType<typeof vi.fn>> }).actor;
    actor.findUniqueOrThrow.mockResolvedValue({ chatDisplayName: '캐러멜', kind: 'SOLO', welcomeMessage: '환영', birthdayMessage: '축하', chatProfileImageUrl: 'https://img/caramel.jpg' });
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕' });
    // 팬 알림엔 앱 아이콘 숫자(안 읽은 수)도 같이(2026-10-15)
    expect(push.sendToUsers).toHaveBeenCalledWith(['fan-1'], expect.any(Function), expect.objectContaining({ senderName: '캐러멜', senderImage: 'https://img/caramel.jpg' }), { withUnreadBadge: true });
    expect(push.notifyActorStaff).toHaveBeenCalledWith('actor-1', expect.any(Function), expect.objectContaining({ senderName: '캐러멜', senderImage: 'https://img/caramel.jpg' }), 'notifyArtistMessages');
  });

  it('환영·생일 메시지가 비어 있으면 보내기 거절(GREETINGS_REQUIRED)', async () => {
    const { service, prisma } = setup();
    const actor = (prisma as unknown as { actor: Record<string, ReturnType<typeof vi.fn>> }).actor;
    actor.findUniqueOrThrow.mockResolvedValueOnce({ kind: 'SOLO', welcomeMessage: '환영', birthdayMessage: null });
    await expect(service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕' })).rejects.toThrow();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('CP방은 환영 메시지만 있으면 보낼 수 있음(2026-10-14)', async () => {
    const { service, prisma } = setup();
    const actor = (prisma as unknown as { actor: Record<string, ReturnType<typeof vi.fn>> }).actor;
    actor.findUniqueOrThrow.mockResolvedValueOnce({ kind: 'COUPLE', welcomeMessage: '환영', birthdayMessage: null });
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕' });
    expect(prisma.message.create).toHaveBeenCalled();
    actor.findUniqueOrThrow.mockResolvedValueOnce({ kind: 'COUPLE', welcomeMessage: null, birthdayMessage: null });
    await expect(service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕' })).rejects.toThrow();
  });

  it('여러 장 보내기: 앞쪽(silent)은 푸시 없음, 마지막 장은 "N개를 보냈어요" 한 건', async () => {
    const { service, fanPushes, staffPushes, prisma } = setup();
    const photo = { mediaType: MessageMediaType.PHOTO, mediaKey: 'actors/actor-1/message/a.jpg' };
    await service.sendBroadcast('admin', 'actor-1', { ...photo, silent: true });
    expect(fanPushes).toHaveLength(0);
    expect(staffPushes).toHaveLength(0);
    // 메시지 저장·마지막 발송 시각은 똑같이
    expect(prisma.subscription.updateMany).toHaveBeenCalled();
    await service.sendBroadcast('admin', 'actor-1', { ...photo, batchCount: 3 });
    expect(fanPushes).toHaveLength(1);
    expect(fanPushes[0]({ locale: 'ko', displayName: 'fan' }).body).toBe('사진·동영상 3개를 보냈어요');
  });
});

describe('MessagesService.sendBroadcast 인용 답장 알림', () => {
  // 인용된 팬 메시지(fan-1 작성) — hidden이면 가려진 인용
  const quoted = (overrides: { status?: UserStatus; blocked?: boolean } = {}) => ({
    id: 'fan-msg',
    senderType: MessageSenderType.FAN,
    body: '오빠 사랑해요',
    mediaType: MessageMediaType.TEXT,
    fanUserId: 'fan-1',
    fanUser: {
      nickname: '민지',
      status: overrides.status ?? UserStatus.ACTIVE,
      deletedAt: null,
      blockedInChannels: overrides.blocked ? [{ id: 'b1' }] : [],
    },
    reports: [],
  });

  function setupQuote(replyTo: ReturnType<typeof quoted>, subscribers = ['fan-1', 'fan-2']) {
    const ctx = setup();
    const prisma = ctx.prisma as unknown as {
      message: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
      subscription: { findMany: ReturnType<typeof vi.fn> };
    };
    prisma.message.create.mockResolvedValue({ id: 'm1', mediaKey: null, mediaUrl: null, replyTo });
    prisma.message.findFirst = vi.fn().mockResolvedValue({ senderType: 'FAN', senderActorId: null, deletedAt: null });
    prisma.subscription.findMany.mockResolvedValue(subscribers.map((userId) => ({ userId })));
    return ctx;
  }

  it('인용된 팬은 일반 알림 대신 "내 메시지에 답장했어요" 한 건만', async () => {
    const { service, push } = setupQuote(quoted());
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '고마워', replyToMessageId: 'fan-msg' });

    expect(push.sendToUsers).toHaveBeenCalledWith(['fan-2'], expect.any(Function), expect.anything(), { withUnreadBadge: true });
    expect(push.sendToUser).toHaveBeenCalledWith(
      'fan-1',
      expect.any(Function),
      expect.objectContaining({ type: 'QUOTED_REPLY', actorId: 'actor-1', messageId: 'm1' }),
      { withUnreadBadge: true },
    );
    const compose = vi.mocked(push.sendToUser).mock.calls[0][1];
    expect(compose({ locale: 'ko', displayName: '민지' })).toEqual({ title: '캐러멜님이 내 메시지에 답장했어요', body: '내 메시지에 답장 · 고마워' });
  });

  it('알림을 끈(구독자 목록에 없는) 팬에겐 인용 알림도 안 감', async () => {
    const { service, push } = setupQuote(quoted(), ['fan-2']);
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '고마워', replyToMessageId: 'fan-msg' });
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(push.sendToUsers).toHaveBeenCalledWith(['fan-2'], expect.any(Function), expect.anything(), { withUnreadBadge: true });
  });

  it('정지·차단돼서 인용이 가려진 팬에겐 따로 알리지 않음', async () => {
    for (const replyTo of [quoted({ status: UserStatus.SUSPENDED }), quoted({ blocked: true })]) {
      const { service, push } = setupQuote(replyTo);
      await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '고마워', replyToMessageId: 'fan-msg' });
      expect(push.sendToUser).not.toHaveBeenCalled();
    }
  });
});

describe('인용 답장 요약(toQuote)', () => {
  const base = {
    id: 'q1',
    senderType: 'FAN' as const,
    body: '오늘도 화이팅!',
    mediaType: 'TEXT' as const,
    fanUser: { nickname: '캐러멜바라기', status: 'ACTIVE' as const },
    reports: [],
  };

  it('팬 메시지는 닉네임 + 본문 앞부분', () => {
    expect(toQuote(base)).toEqual({ id: 'q1', hidden: false, retracted: false, nickname: '캐러멜바라기', body: '오늘도 화이팅!' });
    expect(toQuote({ ...base, body: 'a'.repeat(300) })?.body).toHaveLength(120);
  });

  it('정지·차단된 팬이거나 신고 처리된 메시지면 내용과 닉네임을 가림', () => {
    const hidden = { id: 'q1', hidden: true, retracted: false, nickname: null, body: null };
    expect(toQuote({ ...base, fanUser: { nickname: 'x', status: 'BANNED' } })).toEqual(hidden);
    expect(toQuote({ ...base, fanUser: { nickname: 'x', status: 'SUSPENDED' } })).toEqual(hidden);
    expect(toQuote({ ...base, reports: [{ id: 'r1' }] })).toEqual(hidden);
  });

  it('팬이 회수한 답장을 인용했으면 "회수된 메시지"(2026-10-14)', () => {
    expect(toQuote({ ...base, deletedAt: new Date() })).toEqual({ id: 'q1', hidden: true, retracted: true, nickname: null, body: null });
  });

  it('아티스트 메시지(팬 답장이 자동으로 묶인 경우)는 인용이 아님', () => {
    expect(toQuote({ ...base, senderType: 'ARTIST', fanUser: null })).toBeNull();
    expect(toQuote({ ...base, senderType: 'ARTIST', fanUser: null }, 'FAN')).toBeNull();
    expect(toQuote(null)).toBeNull();
  });

  it('CP방에서 아티스트가 상대 아티스트 메시지를 인용하면 이름과 글을 보여 줌(2026-10-15)', () => {
    const quote = toQuote({ ...base, senderType: 'ARTIST', fanUser: null, senderActor: { chatDisplayName: '누가' } }, 'ARTIST');
    expect(quote).toMatchObject({ hidden: false, artistName: '누가', nickname: null });
    expect(toQuote({ ...base, senderType: 'ARTIST', fanUser: null, deletedAt: new Date() }, 'ARTIST')).toMatchObject({ hidden: true, retracted: true, body: null });
  });
});

// 팬 답장 횟수 제한 — 스타 메시지 하나당 N개(기본 3, FAN_REPLIES_PER_MESSAGE)
function replySetup(alreadySent: number, settings: Record<string, string> = {}) {
  const created = vi.fn().mockResolvedValue({ id: 'r1' });
  const prisma = {
    subscription: {
      findUnique: vi.fn().mockResolvedValue({ startedAt: new Date(0), cancelledAt: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    actorFanBlock: { findUnique: vi.fn().mockResolvedValue(null) },
    message: {
      findFirst: vi.fn().mockResolvedValue({ id: 'star-1' }),
      // 중복 방지 키로 이미 저장된 답장 찾기(2026-10-25) — 기본은 없음
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(alreadySent),
      create: created,
    },
    // 같은 팬·같은 방 답장 줄 세우기(advisory lock)
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as unknown as PrismaService;
  // 트랜잭션 안에서도 같은 가짜 DB를 씀
  (prisma as unknown as { $transaction: unknown }).$transaction = vi.fn((work: (tx: PrismaService) => Promise<unknown>) => work(prisma));
  const moderation = { assertNoBannedWords: vi.fn().mockResolvedValue(undefined) } as unknown as ModerationService;
  const service = new MessagesService(prisma, {} as PushService, moderation, {} as MediaService, config(settings), realtime);
  return { service, created, prisma };
}

describe('MessagesService 답장 횟수 제한', () => {
  it('3개 미만이면 보내지고, 3개째까지 허용', async () => {
    const { service, created } = replySetup(2);
    await service.sendReply('fan', 'actor', { body: '안녕' });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ replyToMessageId: 'star-1' }) }));
  });

  it('이미 3개 보냈으면 거절', async () => {
    const { service, created } = replySetup(3);
    await expect(service.sendReply('fan', 'actor', { body: '안녕' })).rejects.toThrow('3개까지');
    expect(created).not.toHaveBeenCalled();
  });

  it('설정값으로 바꿀 수 있고, 남은 개수를 알려줌', async () => {
    const { service } = replySetup(4, { FAN_REPLIES_PER_MESSAGE: '5' });
    await expect(service.replyQuota('fan', 'actor')).resolves.toEqual({ messageId: 'star-1', limit: 5, used: 4, remaining: 1, blocked: false });
  });

  it('차단된 팬은 남은 답장 0개 + blocked(입력칸을 미리 막음)', async () => {
    const { service, prisma } = replySetup(0);
    vi.mocked(prisma.actorFanBlock.findUnique).mockResolvedValue({ id: 'block-1' } as never);
    await expect(service.replyQuota('fan', 'actor')).resolves.toEqual({ messageId: 'star-1', limit: 3, used: 0, remaining: 0, blocked: true });
  });

  it('지워진 아티스트 메시지는 답장 대상에서 빠짐', async () => {
    const { service, prisma } = replySetup(0);
    await service.replyQuota('fan', 'actor');
    expect(prisma.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }));
  });
});


// 중복 방지 키(2026-10-25) — 서버는 저장했는데 응답이 끊겨 앱이 같은 키로 다시 보낸 경우
describe('MessagesService 답장 다시 보내기(중복 방지 키)', () => {
  it('같은 키로 이미 저장됐으면 새로 만들지 않고 그대로 돌려줌 — 한도·차단 확인도, 실시간 신호도 다시 안 함', async () => {
    const { service, created, prisma } = replySetup(3);
    vi.mocked(prisma.message.findUnique).mockResolvedValue({ id: 'r-old', senderType: 'FAN', fanUserId: 'fan', replyToMessageId: 'star-1' } as never);
    vi.mocked(prisma.actorFanBlock.findUnique).mockResolvedValue({ id: 'block-1' } as never);
    vi.mocked(realtime.publish).mockClear();
    // 이미 3개(한도)여도, 그 뒤 차단됐어도 — 이미 보낸 답장이라 성공
    await expect(service.sendReply('fan', 'actor', { body: '안녕', clientMessageId: 'key-123456' })).resolves.toMatchObject({ id: 'r-old' });
    expect(created).not.toHaveBeenCalled();
    expect(realtime.publish).not.toHaveBeenCalled();
    expect(prisma.message.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actorId_clientMessageId: { actorId: 'actor', clientMessageId: 'key-123456' } } }),
    );
  });

  it('새 키면 키를 같이 저장하고, 같은 팬·같은 방 답장은 잠금으로 줄을 세움', async () => {
    const { service, created, prisma } = replySetup(0);
    await service.sendReply('fan', 'actor', { body: '안녕', clientMessageId: 'key-new-0001' });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientMessageId: 'key-new-0001' }) }));
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('줄을 서는 사이 같은 키의 앞 요청이 저장했으면 그걸 돌려줌(답장 개수 한 번만)', async () => {
    const { service, created, prisma } = replySetup(2);
    vi.mocked(prisma.message.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r-first', senderType: 'FAN', fanUserId: 'fan' } as never);
    await expect(service.sendReply('fan', 'actor', { body: '안녕', clientMessageId: 'key-race-01' })).resolves.toMatchObject({ id: 'r-first' });
    expect(created).not.toHaveBeenCalled();
  });

  it('다른 사람 메시지의 키와 겹치면 409(남의 메시지를 돌려주지 않음)', async () => {
    const { service, prisma } = replySetup(0);
    vi.mocked(prisma.message.findUnique).mockResolvedValue({ id: 'other', senderType: 'FAN', fanUserId: 'someone-else' } as never);
    await expect(service.sendReply('fan', 'actor', { body: '안녕', clientMessageId: 'key-other-1' })).rejects.toThrow(ConflictException);
  });

  it('키 없이 보내는 예전 앱은 예전처럼(키 조회 없음)', async () => {
    const { service, created, prisma } = replySetup(0);
    await service.sendReply('fan', 'actor', { body: '안녕' });
    expect(prisma.message.findUnique).not.toHaveBeenCalled();
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientMessageId: null }) }));
  });
});

describe('MessagesService 스타 메시지 다시 보내기(중복 방지 키)', () => {
  it('같은 키로 이미 저장됐으면 새로 만들지 않고 푸시·실시간 신호도 다시 안 보냄 — 사진도 파일 확인을 다시 안 함', async () => {
    const { service, prisma, push } = setup();
    const message = (prisma as unknown as { message: Record<string, ReturnType<typeof vi.fn>> }).message;
    message.findUnique = vi.fn().mockResolvedValue({ id: 'm-old', senderType: 'ARTIST', senderActorId: 'actor-1', mediaKey: 'k', mediaUrl: null, replyTo: null });
    vi.mocked(realtime.publish).mockClear();
    const sent = await service.sendBroadcast('admin', 'actor-1', {
      mediaType: MessageMediaType.PHOTO,
      mediaKey: 'actors/actor-1/message/new.jpg',
      clientMessageId: 'photo-key-01',
    });
    expect(sent).toMatchObject({ id: 'm-old' });
    expect(message.create).not.toHaveBeenCalled();
    expect(push.sendToUsers).not.toHaveBeenCalled();
    expect(push.notifyActorStaff).not.toHaveBeenCalled();
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it('동시에 같은 키 두 요청 — 고유 제약에 걸린 쪽은 먼저 저장된 메시지를 돌려주고 알림은 안 보냄', async () => {
    const { service, prisma, push } = setup();
    const message = (prisma as unknown as { message: Record<string, ReturnType<typeof vi.fn>> }).message;
    message.findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'm-first', senderType: 'ARTIST', senderActorId: 'actor-1', mediaKey: null, mediaUrl: null, replyTo: null });
    message.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target: ['actorId', 'clientMessageId'] } }),
    );
    await expect(service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕', clientMessageId: 'text-key-01' })).resolves.toMatchObject({
      id: 'm-first',
    });
    expect(push.sendToUsers).not.toHaveBeenCalled();
  });

  it('새 키면 키를 같이 저장하고 평소처럼 알림', async () => {
    const { service, prisma, push } = setup();
    const message = (prisma as unknown as { message: Record<string, ReturnType<typeof vi.fn>> }).message;
    message.findUnique = vi.fn().mockResolvedValue(null);
    await service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '안녕', clientMessageId: 'text-key-02' });
    expect(message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientMessageId: 'text-key-02' }) }));
    expect(push.sendToUsers).toHaveBeenCalled();
  });
});

describe('MessagesService.listBroadcasts 팬 답장 흐름 미리보기', () => {
  const broadcast = (id: string, replies: number, deletedAt: Date | null = null) => ({
    id,
    mediaKey: null,
    mediaUrl: null,
    deletedAt,
    replyTo: null,
    _count: { replies },
  });

  function previewSetup(broadcasts: ReturnType<typeof broadcast>[]) {
    const findMany = vi.fn((args: { where: { senderType: string; replyToMessageId?: string } }) =>
      args.where.senderType === 'ARTIST'
        ? Promise.resolve(broadcasts)
        : // 최신 순으로 옴
          Promise.resolve([
            { id: `${args.where.replyToMessageId}-r2`, body: '두 번째', createdAt: new Date(2), fanUser: { nickname: '민지' } },
            { id: `${args.where.replyToMessageId}-r1`, body: '첫 번째', createdAt: new Date(1), fanUser: null },
          ]),
    );
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: Role.ADMIN }) },
      actor: { findFirst: vi.fn().mockResolvedValue(null) },
      message: { findMany },
    } as unknown as PrismaService;
    const media = { withReadUrls: vi.fn((items: object[]) => Promise.resolve(items)) } as unknown as MediaService;
    const service = new MessagesService(prisma, {} as PushService, {} as ModerationService, media, config(), realtime);
    return { service, findMany };
  }

  it('답장이 있는 메시지에 최근 답장을 오래된 것 → 최신 순으로 붙임', async () => {
    const { service, findMany } = previewSetup([broadcast('m1', 2), broadcast('m2', 0), broadcast('m3', 5, new Date())]);
    const result = (await service.listBroadcasts('admin', 'actor-1')) as unknown as {
      id: string;
      recentReplies?: { id: string; nickname: string | null; body: string }[];
    }[];

    expect(result[0].recentReplies?.map((r) => r.body)).toEqual(['첫 번째', '두 번째']);
    expect(result[0].recentReplies?.[1]).toMatchObject({ nickname: '민지' });
    // 답장 없는 최근 메시지는 빈 줄(조회는 안 함), 삭제한 메시지는 줄 자체가 없음
    expect(result[1].recentReplies).toEqual([]);
    expect(result[2].recentReplies).toBeUndefined();
    expect(findMany).toHaveBeenCalledTimes(2);
    // 정지·탈퇴·차단·신고 처리된 답장 제외 조건
    expect(findMany.mock.calls[1][0]).toMatchObject({
      where: { fanUser: { status: 'ACTIVE', deletedAt: null }, reports: { none: { status: 'RESOLVED' } } },
      take: 20,
    });
  });

  it('최근 메시지 10개까지만 미리보기', async () => {
    const { service, findMany } = previewSetup(Array.from({ length: 15 }, (_, i) => broadcast(`m${i}`, 1)));
    const result = (await service.listBroadcasts('admin', 'actor-1')) as unknown as { recentReplies?: unknown[] }[];
    expect(findMany).toHaveBeenCalledTimes(11);
    expect(result[9].recentReplies).toBeDefined();
    expect(result[10].recentReplies).toBeUndefined();
  });
});

describe('MessagesService.listReplies 나눠 받기', () => {
  function listSetup() {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: Role.ADMIN }) },
      actor: { findFirst: vi.fn().mockResolvedValue(null) },
      message: { findMany },
    } as unknown as PrismaService;
    const service = new MessagesService(prisma, {} as PushService, {} as ModerationService, {} as MediaService, config(), realtime);
    return { service, findMany };
  }

  it('limit·before를 주면 그 답장 이전 N개(같은 시각은 id로 순서 고정)', async () => {
    const { service, findMany } = listSetup();
    await service.listReplies('admin', 'actor-1', 'm1', { limit: 100, before: 'r50' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, cursor: { id: 'r50' }, skip: 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    );
  });

  it('안 주면 전부(콘솔 기존 동작)', async () => {
    const { service, findMany } = listSetup();
    await service.listReplies('admin', 'actor-1');
    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.take).toBeUndefined();
    expect(args.cursor).toBeUndefined();
  });
});

describe('MessagesService.deleteBroadcast 소속사 대신 삭제(2026-10-12)', () => {
  function setupDelete(role: Role, viewable: boolean) {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'staff-1', role, agencyId: 'ag-1' }) },
      actor: { findFirst: vi.fn().mockResolvedValue(viewable ? { id: 'actor-1' } : null) },
      message: {
        findFirst: vi.fn().mockResolvedValue({ id: 'm1', deletedAt: null, mediaKey: null, thumbnailKey: null, _count: { reports: 0 } }),
        update,
      },
    } as unknown as PrismaService;
    const media = { deleteQuietly: vi.fn().mockResolvedValue(undefined) } as unknown as MediaService;
    const service = new MessagesService(prisma, {} as PushService, {} as ModerationService, media, config(), realtime);
    return { service, update };
  }

  it('자기 소속 아티스트 메시지면 지우고 지운 직원을 기록', async () => {
    const { service, update } = setupDelete(Role.AGENCY_STAFF, true);
    await service.deleteBroadcast('staff-1', 'actor-1', 'm1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedByStaffId: 'staff-1' }) }));
  });

  it('다른 소속사 아티스트면 거절', async () => {
    const { service, update } = setupDelete(Role.AGENCY_STAFF, false);
    await expect(service.deleteBroadcast('staff-1', 'actor-1', 'm1')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('MessagesService.deleteBroadcast CP방 본인 메시지만(2026-10-27)', () => {
  function setupCouple(senderActorId: string | null, mediaUsedElsewhere = 0) {
    const update = vi.fn().mockResolvedValue({});
    const count = vi.fn().mockResolvedValue(mediaUsedElsewhere);
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'u-pakin', role: Role.ACTOR }) },
      actor: {
        findUnique: vi.fn().mockResolvedValue({
          kind: 'COUPLE',
          selfUserId: null,
          coupleMembers: [{ member: { id: 'nawin', selfUserId: 'u-nawin' } }, { member: { id: 'pakin', selfUserId: 'u-pakin' } }],
        }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue({ id: 'm1', deletedAt: null, senderActorId, mediaKey: 'actors/c1/message/a.jpg', thumbnailKey: null, _count: { reports: 0 } }),
        update,
        count,
      },
    } as unknown as PrismaService;
    const media = { deleteQuietly: vi.fn().mockResolvedValue(undefined) } as unknown as MediaService;
    const service = new MessagesService(prisma, {} as PushService, {} as ModerationService, media, config(), realtime);
    return { service, update, media };
  }

  it('상대 멤버가 보낸 메시지는 회수·파일 삭제 불가', async () => {
    const { service, update, media } = setupCouple('nawin');
    await expect(service.deleteBroadcast('u-pakin', 'c1', 'm1')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(media.deleteQuietly).not.toHaveBeenCalled();
  });

  it('내가 보낸 메시지는 회수하고 파일도 지움', async () => {
    const { service, update, media } = setupCouple('pakin');
    await service.deleteBroadcast('u-pakin', 'c1', 'm1');
    expect(update).toHaveBeenCalled();
    expect(media.deleteQuietly).toHaveBeenCalledWith('actors/c1/message/a.jpg');
  });

  it('같은 파일 키를 다른 메시지도 쓰면 파일은 남김', async () => {
    const { service, media } = setupCouple('pakin', 1);
    await service.deleteBroadcast('u-pakin', 'c1', 'm1');
    expect(media.deleteQuietly).not.toHaveBeenCalled();
  });
});

describe('MessagesService.sendBroadcast 회수된 팬 답장 인용(2026-10-27)', () => {
  it('팬이 이미 회수한 답장은 인용 불가(QUOTE_INVALID)', async () => {
    const { service, prisma } = setup();
    (prisma as unknown as { message: { findFirst: ReturnType<typeof vi.fn> } }).message.findFirst = vi
      .fn()
      .mockResolvedValue({ senderType: 'FAN', senderActorId: null, deletedAt: new Date() });
    await expect(service.sendBroadcast('admin', 'actor-1', { mediaType: MessageMediaType.TEXT, body: '고마워', replyToMessageId: 'fan-msg' })).rejects.toThrow();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe('MessagesService 팬 화면 응답(2026-10-27)', () => {
  function setupFan(role: Role = Role.USER, managesRoom = false) {
    const prisma = {
      subscription: {
        findUnique: vi.fn().mockResolvedValue({ startedAt: new Date('2026-09-01'), cancelledAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'fan', role, agencyId: null, nickname: '민지', displayName: '민지' }) },
      actor: { findFirst: vi.fn().mockResolvedValue(managesRoom ? { id: 'a1' } : null), findMany: vi.fn().mockResolvedValue([]) },
      message: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'm1', senderType: 'ARTIST', senderActorId: null, body: '안녕', deletedAt: null, deletedByAdmin: false, deletedByStaffId: null, clientMessageId: 'star-key', replyTo: null },
          { id: 'm2', senderType: 'FAN', fanUserId: 'fan', body: '응', deletedAt: null, deletedByAdmin: false, deletedByStaffId: null, clientMessageId: 'my-key', replyTo: null },
        ]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const media = { withReadUrls: vi.fn((items: object[]) => Promise.resolve(items)) } as unknown as MediaService;
    const service = new MessagesService(prisma, {} as PushService, {} as ModerationService, media, config(), realtime);
    return { service, prisma };
  }

  it('지운 사람·아티스트 중복 방지 키 같은 내부 기록은 팬에게 안 내려줌(내 답장 키는 남김)', async () => {
    const { service } = setupFan();
    const [artist, mine] = (await service.listForFan('fan', 'a1')) as Record<string, unknown>[];
    for (const field of ['deletedByAdmin', 'deletedByStaffId', 'clientMessageId']) expect(artist).not.toHaveProperty(field);
    expect(mine).not.toHaveProperty('deletedByStaffId');
    expect(mine.clientMessageId).toBe('my-key');
  });

  it('다른 방을 구독한 아티스트·소속사 계정은 사진 모아보기를 구독자 범위로(예전엔 403)', async () => {
    const { service, prisma } = setupFan(Role.AGENCY_STAFF, false);
    await service.listMediaForFan('fan', 'a1');
    const where = vi.mocked(prisma.message.findMany).mock.calls[0][0]!.where as { createdAt?: unknown };
    expect(where.createdAt).toEqual({ gte: new Date('2026-09-01') });
  });

  it('관리하는 방이면 전체(구독 시작 제한 없음)', async () => {
    const { service, prisma } = setupFan(Role.AGENCY_STAFF, true);
    await service.listMediaForFan('fan', 'a1');
    const where = vi.mocked(prisma.message.findMany).mock.calls[0][0]!.where as { createdAt?: unknown };
    expect(where.createdAt).toBeUndefined();
  });

  it('관리하지도 구독하지도 않으면 거절', async () => {
    const { service, prisma } = setupFan(Role.ACTOR, false);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    await expect(service.listMediaForFan('fan', 'a1')).rejects.toThrow();
  });
});
