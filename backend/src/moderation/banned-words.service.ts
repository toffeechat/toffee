import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBannedWordDto } from './dto/create-banned-word.dto.js';
import { appError } from '../common/i18n/app-error.js';
import { AuditService } from '../audit/audit.service.js';
import { ModerationService } from './moderation.service.js';
import { DEFAULT_BANNED_WORDS } from './default-banned-words.js';

@Injectable()
export class BannedWordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.bannedWord.findMany({ orderBy: [{ language: 'asc' }, { term: 'asc' }] });
  }

  async create(adminId: string, dto: CreateBannedWordDto) {
    const term = dto.term.trim();
    const existing = await this.prisma.bannedWord.findUnique({ where: { term_language: { term, language: dto.language } } });
    if (existing) throw new BadRequestException(appError('BANNED_WORD_EXISTS'));
    const word = await this.prisma.bannedWord.create({ data: { term, language: dto.language } });
    await this.audit.record(adminId, 'BANNED_WORD_CREATE', 'BANNED_WORD', word.id, { term, language: dto.language });
    return word;
  }

  async remove(adminId: string, id: string) {
    // 이미 지워졌거나 없는 id면 404(2026-10-28 — 예전엔 delete가 P2025로 500)
    const existing = await this.prisma.bannedWord.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(appError('NOT_FOUND'));
    const word = await this.prisma.bannedWord.delete({ where: { id } });
    await this.audit.record(adminId, 'BANNED_WORD_DELETE', 'BANNED_WORD', id, { term: word.term, language: word.language });
  }

  /** 기본 목록 넣기(2026-10-20) — 없는 것만 추가(지운 기본 단어도 다시 들어오니 화면에서 안내). 언어를 주면 그 언어만 */
  async addDefaults(adminId: string, language?: string) {
    const data = Object.entries(DEFAULT_BANNED_WORDS)
      .filter(([lang]) => !language || lang === language)
      .flatMap(([lang, terms]) => terms.map((term) => ({ term, language: lang, isDefault: true })));
    const { count } = await this.prisma.bannedWord.createMany({ data, skipDuplicates: true });
    await this.audit.record(adminId, 'BANNED_WORD_DEFAULTS', 'BANNED_WORD', language ?? 'all', { added: count });
    return { added: count };
  }

  /** 테스트해 보기 — 이 글이 막히는지, 어떤 단어 때문인지 */
  async test(text: string) {
    return { hits: await this.moderation.findHits(text) };
  }
}
