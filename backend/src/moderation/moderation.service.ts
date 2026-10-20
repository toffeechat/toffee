import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { appError } from '../common/i18n/app-error.js';
import { matchesBannedWord } from './default-banned-words.js';

// 팬 답장·닉네임 전송 전 대조용 — 금칙어는 언어와 상관없이 모두에게 적용(팬이 어느 언어로든 쓸 수 있어서). 수백 개 수준이라
// 매번 전체 조회해도 무방함. 비교 규칙은 matchesBannedWord(띄어쓰기 언어는 단어 단위, 2026-10-20).
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoBannedWords(text: string): Promise<void> {
    if ((await this.findHits(text)).length > 0) {
      throw new BadRequestException(appError('CONTENT_INAPPROPRIATE'));
    }
  }

  /** 글에 걸린 금칙어 목록 — 운영자 화면 "테스트해 보기"도 같은 규칙 */
  async findHits(text: string) {
    const bannedWords = await this.prisma.bannedWord.findMany({ select: { id: true, term: true, language: true } });
    return bannedWords.filter((word) => matchesBannedWord(text, word.term, word.language));
  }
}
