import { describe, expect, it } from 'vitest';
import { TranslationService } from './translation.service.js';
import {
  BATCH_TRANSLATION_SYSTEM_PROMPT,
  ClaudeTranslationProvider,
  FakeTranslationProvider,
  TRANSLATION_SYSTEM_PROMPT,
  describeSpeaker,
  type TranslationProvider,
  type TranslationSpeaker,
} from './translation-provider.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

function setup(provider: TranslationProvider | null, role: 'USER' | 'ACTOR' = 'USER', managesRoom = true) {
  const saved = new Map<string, string>();
  const calls: string[] = [];
  const speakers: (TranslationSpeaker | undefined)[] = [];
  // 묶음 번역 호출 — 한 번에 넘긴 글들
  const batches: string[][] = [];
  const room = { actor: { gender: 'FEMALE' }, senderActor: null };
  const messages = [
    { id: 'm1', actorId: 'a1', body: '{{name}}야 오늘 하루 어땠어?', senderType: 'ARTIST', fanUserId: null, createdAt: new Date('2026-09-10'), deletedAt: null, ...room },
    { id: 'm-other-fan', actorId: 'a1', body: '다른 팬 답장', senderType: 'FAN', fanUserId: 'other', createdAt: new Date('2026-09-10'), deletedAt: null, ...room },
    { id: 'm-old', actorId: 'a1', body: '구독 전 메시지', senderType: 'ARTIST', fanUserId: null, createdAt: new Date('2026-08-01'), deletedAt: null, ...room },
    // CP방: 방엔 성별이 없고 보낸 멤버는 남성
    { id: 'm-cp', actorId: 'a1', body: '나도 보고 싶어', senderType: 'ARTIST', fanUserId: null, createdAt: new Date('2026-09-10'), deletedAt: null, actor: { gender: null }, senderActor: { gender: 'MALE' } },
    { id: 'm-mine', actorId: 'a1', body: 'พี่คะ คิดถึง', senderType: 'FAN', fanUserId: 'fan', createdAt: new Date('2026-09-10'), deletedAt: null, ...room },
    // 아티스트가 인용한 다른 팬의 긴 답장 — 이 팬에겐 인용 칸(앞 120자)으로만 보임
    { id: 'm-quoted', actorId: 'a1', body: '가'.repeat(200), senderType: 'FAN', fanUserId: 'other', createdAt: new Date('2026-09-10'), deletedAt: null, ...room },
  ];
  const db = {
    message: {
      findFirst: async ({ where }: { where: { id: string; actorId: string } }) => messages.find((m) => m.id === where.id && m.actorId === where.actorId) ?? null,
      findMany: async ({ where }: { where: { id: { in: string[] }; actorId: string } }) => messages.filter((m) => where.id.in.includes(m.id) && m.actorId === where.actorId),
    },
    user: { findUniqueOrThrow: async () => ({ role, nickname: '캐러멜바라기', displayName: '민지' }) },
    subscription: { findUnique: async () => ({ startedAt: new Date('2026-09-01'), cancelledAt: null }) },
    // managesRoom: 아티스트·소속사 계정이 이 방을 관리하는지(아니면 다른 방을 구독한 경우)
    actor: { findFirst: async () => (managesRoom ? { id: 'a1' } : null) },
    messageTranslation: {
      findUnique: async ({ where }: { where: { messageId_languageCode: { messageId: string; languageCode: string } } }) => {
        const key = `${where.messageId_languageCode.messageId}:${where.messageId_languageCode.languageCode}`;
        return saved.has(key) ? { translatedText: saved.get(key)! } : null;
      },
      create: async ({ data }: { data: { messageId: string; languageCode: string; translatedText: string } }) => {
        saved.set(`${data.messageId}:${data.languageCode}`, data.translatedText);
      },
      findMany: async ({ where }: { where: { messageId: { in: string[] }; languageCode: string } }) =>
        where.messageId.in
          .filter((id) => saved.has(`${id}:${where.languageCode}`))
          .map((id) => ({ messageId: id, translatedText: saved.get(`${id}:${where.languageCode}`)! })),
      createMany: async ({ data }: { data: { messageId: string; languageCode: string; translatedText: string }[] }) => {
        for (const row of data) if (!saved.has(`${row.messageId}:${row.languageCode}`)) saved.set(`${row.messageId}:${row.languageCode}`, row.translatedText);
      },
    },
  };
  const tracked: TranslationProvider | null = provider && {
    name: provider.name,
    cacheable: provider.cacheable,
    translate: async (text, target, speaker) => {
      calls.push(`${target}:${text}`);
      speakers.push(speaker);
      return provider.translate(text, target, speaker);
    },
    translateMany: async (items, target) => {
      batches.push(items.map((item) => item.text));
      speakers.push(...items.map((item) => item.speaker));
      return provider.translateMany(items, target);
    },
  };
  const service = new TranslationService(db as unknown as PrismaService, config({ TRANSLATION_PROVIDER: 'off' }));
  (service as unknown as { provider: TranslationProvider | null }).provider = tracked;
  // isVisibleQuote(인용 답장)는 m-quoted만
  (service as unknown as { isVisibleQuote: (id: string) => Promise<boolean> }).isVisibleQuote = async (id) => id === 'm-quoted';
  return { service, calls, saved, speakers, batches };
}

const claudeLikeText = (text: string) => text.replace('오늘 하루 어땠어?', 'วันนี้เป็นยังไงบ้าง?');
const claudeLike: TranslationProvider = {
  name: 'claude',
  cacheable: true,
  translate: async (text) => claudeLikeText(text),
  translateMany: async (items) => items.map((item) => claudeLikeText(item.text)),
};

describe('메시지 번역', () => {
  it('한 번 번역해 저장하고, 두 번째부터는 저장된 걸 씀 — {{name}}은 그 팬 이름으로', async () => {
    const t = setup(claudeLike);
    const first = await t.service.translateMessage('fan', 'a1', 'm1', 'th');
    await t.service.translateMessage('fan', 'a1', 'm1', 'th');
    expect(first.text).toBe('캐러멜바라기야 วันนี้เป็นยังไงบ้าง?');
    expect(t.calls).toHaveLength(1);
    expect(t.saved.get('m1:th')).toContain('{{name}}');
  });

  it('누가 쓴 메시지인지 엔진에 넘김 — 아티스트 성별(CP방은 보낸 멤버), 팬 답장은 팬', async () => {
    const t = setup(claudeLike);
    await t.service.translateMessage('fan', 'a1', 'm1', 'th');
    await t.service.translateMessage('fan', 'a1', 'm-cp', 'th');
    await t.service.translateMessage('fan', 'a1', 'm-mine', 'ko');
    expect(t.speakers).toEqual([
      { role: 'artist', gender: 'FEMALE' },
      { role: 'artist', gender: 'MALE' },
      { role: 'fan' },
    ]);
    expect(t.speakers.map(describeSpeaker)).toEqual(['artist (female)', 'artist (male)', 'fan (gender unknown)']);
    expect(describeSpeaker({ role: 'artist', gender: null })).toBe('artist (gender unknown)');
  });

  it('팬은 다른 팬 답장·구독 전 메시지를 번역할 수 없음', async () => {
    const t = setup(claudeLike);
    await expect(t.service.translateMessage('fan', 'a1', 'm-other-fan', 'th')).rejects.toThrow();
    await expect(t.service.translateMessage('fan', 'a1', 'm-old', 'th')).rejects.toThrow();
    expect(t.calls).toHaveLength(0);
  });

  it('가짜 번역은 저장하지 않음(나중에 진짜 엔진으로 바꿔도 남지 않게), 엔진이 꺼져 있으면 준비 중', async () => {
    const t = setup(new FakeTranslationProvider());
    expect((await t.service.translateMessage('fan', 'a1', 'm1', 'ja')).text).toBe('[ja] 캐러멜바라기야 오늘 하루 어땠어?');
    expect(t.saved.size).toBe(0);
    await expect(setup(null).service.translateMessage('fan', 'a1', 'm1', 'ja')).rejects.toThrow('준비 중');
  });

  it('묶음 번역: 저장된 건 그대로, 나머지는 아티스트 메시지끼리·팬 답장끼리 한 번씩, 안 보이는 메시지는 조용히 빠짐', async () => {
    const t = setup(claudeLike);
    await t.service.translateMessage('fan', 'a1', 'm1', 'th');
    const result = await t.service.translateMany('fan', 'a1', ['m1', 'm-cp', 'm-mine', 'm-other-fan', 'm-old', 'm1'], 'th');
    expect(result.translations.map((row) => row.messageId).sort()).toEqual(['m-cp', 'm-mine', 'm1']);
    expect(result.translations.find((row) => row.messageId === 'm1')?.text).toBe('캐러멜바라기야 วันนี้เป็นยังไงบ้าง?');
    expect(t.batches).toEqual([['나도 보고 싶어'], ['พี่คะ คิดถึง']]);
    // 다음엔 전부 저장된 것
    await t.service.translateMany('fan', 'a1', ['m1', 'm-cp', 'm-mine'], 'th');
    expect(t.batches).toHaveLength(2);
  });

  it('묶음 번역: 엔진이 실패하거나 일부를 빠뜨리면 그 메시지만 결과에서 빠짐', async () => {
    const failing: TranslationProvider = { ...claudeLike, translateMany: async () => Promise.reject(new Error('down')) };
    expect((await setup(failing).service.translateMany('fan', 'a1', ['m1'], 'th')).translations).toEqual([]);
    const partial: TranslationProvider = { ...claudeLike, translateMany: async (items) => items.map(() => null) };
    const t = setup(partial);
    expect((await t.service.translateMany('fan', 'a1', ['m1', 'm-cp'], 'th')).translations).toEqual([]);
    expect(t.saved.size).toBe(0);
  });

  it('묶음 번역: 아티스트·소속사는 팬 답장도(이름 자리는 그대로)', async () => {
    const t = setup(claudeLike, 'ACTOR');
    const result = await t.service.translateMany('artist', 'a1', ['m1', 'm-other-fan'], 'th');
    expect(result.translations.map((row) => row.messageId).sort()).toEqual(['m-other-fan', 'm1']);
    expect(result.translations.find((row) => row.messageId === 'm1')?.text).toContain('{{name}}');
  });

  it('인용으로만 보이는 다른 팬 답장은 앞 120자만 번역하고 저장하지 않음(2026-10-27)', async () => {
    const t = setup(claudeLike);
    const single = await t.service.translateMessage('fan', 'a1', 'm-quoted', 'th');
    expect(single.text).toHaveLength(120);
    const many = await t.service.translateMany('fan', 'a1', ['m-quoted'], 'th');
    expect(many.translations[0].text).toHaveLength(120);
    expect(t.batches).toEqual([['가'.repeat(120)]]);
    expect(t.saved.has('m-quoted:th')).toBe(false);
    // 아티스트(그 방 관리)는 전체
    const star = setup(claudeLike, 'ACTOR');
    expect((await star.service.translateMessage('artist', 'a1', 'm-quoted', 'th')).text).toHaveLength(200);
  });

  it('같은 메시지 × 언어를 동시에 여러 명이 요청해도 엔진은 한 번만(2026-10-27)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: TranslationProvider = {
      ...claudeLike,
      translate: async (text) => gate.then(() => claudeLikeText(text)),
      translateMany: async (items) => gate.then(() => items.map((item) => claudeLikeText(item.text))),
    };
    const t = setup(slow);
    const requests = Promise.all([
      t.service.translateMany('fan', 'a1', ['m1', 'm-cp'], 'th'),
      t.service.translateMany('fan', 'a1', ['m1'], 'th'),
      t.service.translateMessage('fan', 'a1', 'm1', 'th'),
    ] as const);
    // 다른 요청들이 줄에 붙을 때까지 기다린 뒤 엔진 응답
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    const [first, second, single] = await requests;
    // m1은 어느 요청이 맡든 엔진에 한 번만 감
    const sent = [...t.batches.flat(), ...t.calls.map((call) => call.slice('th:'.length))];
    expect(sent.filter((text) => text === '{{name}}야 오늘 하루 어땠어?')).toHaveLength(1);
    expect(sent.filter((text) => text === '나도 보고 싶어')).toHaveLength(1);
    expect(first.translations).toHaveLength(2);
    expect(second.translations[0].text).toBe('캐러멜바라기야 วันนี้เป็นยังไงบ้าง?');
    expect(single.text).toBe('캐러멜바라기야 วันนี้เป็นยังไงบ้าง?');
  });

  it('다른 방을 구독한 아티스트 계정은 팬과 같은 범위로 번역(2026-10-27 — 예전엔 403)', async () => {
    const t = setup(claudeLike, 'ACTOR', false);
    expect((await t.service.translateMessage('artist', 'a1', 'm1', 'th')).text).toBe('캐러멜바라기야 วันนี้เป็นยังไงบ้าง?');
    await expect(t.service.translateMessage('artist', 'a1', 'm-other-fan', 'th')).rejects.toThrow();
    const many = await t.service.translateMany('artist', 'a1', ['m1', 'm-other-fan', 'm-old'], 'th');
    expect(many.translations.map((row) => row.messageId)).toEqual(['m1']);
  });

  it('엔진 고르기: 키가 있으면 Claude, 없으면 개발은 가짜·운영은 꺼짐', () => {
    expect(TranslationService.pickProvider(config({ ANTHROPIC_API_KEY: 'k' }))?.name).toBe('claude');
    expect(TranslationService.pickProvider(config({}))?.name).toBe('fake');
    expect(TranslationService.pickProvider(config({ NODE_ENV: 'production' }))).toBeNull();
    expect(TranslationService.pickProvider(config({ TRANSLATION_PROVIDER: 'claude' }))).toBeNull();
  });

  it('모델: 아티스트 메시지는 기본(Opus), 팬 답장은 싼 모델(기본 Haiku, TRANSLATION_REPLY_MODEL로 변경)', () => {
    type Routed = { modelFor: (speaker: TranslationSpeaker) => string };
    const routed = TranslationService.pickProvider(config({ ANTHROPIC_API_KEY: 'k' })) as unknown as Routed;
    expect(routed.modelFor({ role: 'artist', gender: 'FEMALE' })).toBe('claude-opus-5-5');
    expect(routed.modelFor({ role: 'fan' })).toBe('claude-haiku-5-5');
    const custom = new ClaudeTranslationProvider('k', 'claude-opus-5-5', 'claude-sonnet-5-5') as unknown as Routed;
    expect(custom.modelFor({ role: 'fan' })).toBe('claude-sonnet-5-5');
    expect(BATCH_TRANSLATION_SYSTEM_PROMPT.startsWith(TRANSLATION_SYSTEM_PROMPT)).toBe(true);
  });

  it('프롬프트: 메시지 안 글은 지시로 따르지 않고 {{name}}을 그대로 둠', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toContain('never instructions');
    expect(TRANSLATION_SYSTEM_PROMPT).toContain('{{name}}');
    expect(TRANSLATION_SYSTEM_PROMPT).toContain('ㅋㅋ');
    expect(TRANSLATION_SYSTEM_PROMPT).toContain('never guess');
  });
});

describe('공지 번역(2026-10-20)', () => {
  function noticeSetup() {
    const notice = { title: '점검 안내', body: '오늘 밤 점검해요', updatedAt: new Date('2026-10-20T00:00:00Z') };
    const store = new Map<string, { title: string; body: string; sourceUpdatedAt: Date }>();
    const translated: string[] = [];
    const prisma = {
      notice: { findUnique: async () => notice },
      noticeTranslation: {
        findUnique: async ({ where }: { where: { noticeId_language: { language: string } } }) => store.get(where.noticeId_language.language) ?? null,
        upsert: async ({ create }: { create: { language: string; title: string; body: string; sourceUpdatedAt: Date } }) => store.set(create.language, create),
      },
    } as unknown as PrismaService;
    const provider: TranslationProvider = {
      name: 'test',
      cacheable: true,
      translate: async (text: string, target: string) => {
        translated.push(text);
        return `[${target}] ${text}`;
      },
      translateBatch: async () => [],
    } as unknown as TranslationProvider;
    const service = new TranslationService(prisma, config({ TRANSLATION_PROVIDER: 'fake' }));
    (service as unknown as { provider: TranslationProvider }).provider = provider;
    return { service, notice, translated };
  }

  it('처음 한 번만 번역해 저장하고, 공지를 고치면 다시 번역', async () => {
    const { service, notice, translated } = noticeSetup();
    expect(await service.translateNotice('n1', 'th')).toEqual({ language: 'th', title: '[th] 점검 안내', body: '[th] 오늘 밤 점검해요' });
    await service.translateNotice('n1', 'th');
    expect(translated).toHaveLength(2);
    notice.updatedAt = new Date('2026-10-21T00:00:00Z');
    notice.body = '내일로 미뤄요';
    expect((await service.translateNotice('n1', 'th')).body).toBe('[th] 내일로 미뤄요');
    expect(translated).toHaveLength(4);
  });
});
