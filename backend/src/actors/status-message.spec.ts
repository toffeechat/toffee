import { describe, expect, it, vi } from 'vitest';
import { ActorsService } from './actors.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MediaService } from '../storage/media.service.js';
import type { ModerationService } from '../moderation/moderation.service.js';
import type { ReleaseService } from '../releases/release.service.js';

// 아티스트 상태메시지(2026-10-25) — 본인만, 커플방이면 내 멤버 배우 값, 운영자는 쓰기 불가
describe('ActorsService.updateStatusMessage', () => {
  const setup = (role: string, actor: object, bannedHit = false) => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role }) },
      actor: {
        findUnique: vi.fn().mockResolvedValueOnce(actor).mockResolvedValue(null),
        update,
      },
    };
    const moderation = { assertNoBannedWords: vi.fn(() => (bannedHit ? Promise.reject(new Error('banned')) : Promise.resolve())) };
    const service = new ActorsService(
      prisma as unknown as PrismaService,
      {} as MediaService,
      moderation as unknown as ModerationService,
      {} as ReleaseService,
    );
    // 응답(findOne)은 이 테스트의 관심사가 아님
    vi.spyOn(service, 'findOne').mockResolvedValue({} as never);
    return { service, update };
  };
  const solo = { kind: 'SOLO', selfUserId: 'u1', coupleMembers: [] };
  const couple = {
    kind: 'COUPLE',
    selfUserId: null,
    coupleMembers: [{ member: { id: 'a1', selfUserId: 'u1' } }, { member: { id: 'a2', selfUserId: 'u2' } }],
  };

  it('본인 방이면 공백 정리해서 저장, 빈 값이면 지움', async () => {
    const { service, update } = setup('ACTOR', solo);
    await service.updateStatusMessage('u1', 'a1', '  오늘   촬영 ');
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'a1' }, data: { statusMessage: '오늘 촬영' } });
    const second = setup('ACTOR', solo);
    await second.service.updateStatusMessage('u1', 'a1', '   ');
    expect(second.update).toHaveBeenLastCalledWith({ where: { id: 'a1' }, data: { statusMessage: null } });
  });

  it('커플방 id로 부르면 내 멤버 배우 값을 바꿈', async () => {
    const { service, update } = setup('ACTOR', couple);
    await service.updateStatusMessage('u2', 'cp1', '안녕');
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'a2' }, data: { statusMessage: '안녕' } });
  });

  it('남의 방·운영자의 커플방 쓰기·60자 초과·금칙어는 거절', async () => {
    await expect(setup('ACTOR', solo).service.updateStatusMessage('u9', 'a1', '안녕')).rejects.toThrow();
    await expect(setup('ADMIN', couple).service.updateStatusMessage('admin', 'cp1', '안녕')).rejects.toThrow();
    await expect(setup('ACTOR', solo).service.updateStatusMessage('u1', 'a1', '가'.repeat(61))).rejects.toThrow();
    await expect(setup('ACTOR', solo, true).service.updateStatusMessage('u1', 'a1', '나쁜말')).rejects.toThrow();
  });
});
