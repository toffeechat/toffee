// 소속사 배분율 이력(2026-10-27) — 정산은 "결제가 속한 달"의 배분율로 계산(창립 파트너 70% → 13개월째 60%로 바꾼 뒤 12개월째를
// 마감해도 70%). 한 달의 배분율 = fromMonth가 그 달 이하인 행 중 가장 늦은 것, percent null이거나 행이 없으면 기본값.

export interface ShareRateRow {
  agencyId: string;
  fromMonth: string;
  percent: number | null;
}

/** 소속사별 이력(fromMonth 내림차순) */
export type ShareRateBook = Map<string, ShareRateRow[]>;

export function shareRateBook(rows: ShareRateRow[]): ShareRateBook {
  const book: ShareRateBook = new Map();
  for (const row of rows) {
    const list = book.get(row.agencyId) ?? [];
    list.push(row);
    book.set(row.agencyId, list);
  }
  for (const list of book.values()) list.sort((a, b) => b.fromMonth.localeCompare(a.fromMonth));
  return book;
}

/**
 * 이 달의 배분율. 무소속(agencyId null)은 기본값. 이력이 하나도 없는 소속사는 fallback(소속사의 지금 revenueSharePercent — 이력 도입 전
 * 데이터·테스트용, 마이그레이션이 옮겨 두므로 실제론 이력이 있음) → 기본값.
 */
export function shareRateAt(book: ShareRateBook, agencyId: string | null, month: string, defaultPercent: number, fallback?: number | null): number {
  if (!agencyId) return defaultPercent;
  const list = book.get(agencyId);
  if (!list || list.length === 0) return fallback ?? defaultPercent;
  const row = list.find((candidate) => candidate.fromMonth <= month);
  return row?.percent ?? defaultPercent;
}
