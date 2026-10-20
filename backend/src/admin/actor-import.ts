// 아티스트 일괄 등록(2026-10-19) — 소속사에서 받은 표(영문 이름·닉네임·성별·CP 짝)를 검사해 무엇을 만들지 계획만 세움(DB 없음, 단위 테스트용).
// 실제 저장은 ActorImportService. 오류 문구는 운영자 화면(한국어 전용)에 그대로 보여 줌.

export interface ImportRowInput {
  legalName: string;
  chatDisplayName?: string;
  gender?: 'FEMALE' | 'MALE' | null;
  /** CP 짝 — 상대 영문 이름(표 안이나 이미 등록된 아티스트) */
  partners?: string[];
}

/** 이미 등록된 1인 아티스트(이름 비교용) */
export interface ExistingSolo {
  id: string;
  legalName: string;
  agencyId: string | null;
}

export interface PlannedRow {
  index: number;
  legalName: string;
  chatDisplayName: string;
  gender: 'FEMALE' | 'MALE' | null;
  partners: string[];
  /** new: 새로 만듦 / exists: 같은 소속사에 같은 이름이 있어 건너뜀(CP 짝으로는 씀) / error: 고쳐야 함 */
  status: 'new' | 'exists' | 'error';
  existingId?: string;
  errors: string[];
}

/** 멤버는 표의 줄 번호(new) 또는 기존 아티스트 id */
export type CoupleMemberRef = { row: number } | { actorId: string };

export interface PlannedCouple {
  legalName: string;
  members: [CoupleMemberRef, CoupleMemberRef];
  memberNames: [string, string];
  /** new: 새로 만듦 / exists: 같은 두 사람의 CP방이 이미 있음 */
  status: 'new' | 'exists';
}

export interface ImportPlan {
  rows: PlannedRow[];
  couples: PlannedCouple[];
  /** 직접 고른 CP방 중 만들 수 없는 것(줄이 없음·같은 사람 둘 등) */
  coupleErrors: string[];
  errorCount: number;
}

const MAX_LEGAL_NAME = 100;
const MAX_CHAT_NAME = 50;

/** 이름 비교 — 대소문자·앞뒤 공백·연속 공백 무시 */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** CP방 공식 이름 — "Bright & Win"(나중에 상세에서 바꿀 수 있음) */
export function coupleName(a: string, b: string): string {
  return `${a} & ${b}`;
}

/**
 * @param agencyId 이번에 등록할 소속사(무소속이면 null) — 같은 소속사에 같은 이름이 있으면 "이미 있음"
 * @param existing 지금 등록된 1인 아티스트 전부 — CP 짝을 표 밖에서 찾을 때(같은 소속사 먼저, 없으면 이름이 하나뿐인 경우만)
 * @param existingCouples 지금 있는 CP방의 멤버 id 쌍
 * @param explicitCouples 화면에서 멤버를 직접 고른 CP방(2026-10-20) — 표의 줄 번호 또는 기존 아티스트 id 둘. 엑셀의 CP 짝(이름)과 같이 써도 같은 쌍은 한 번만
 */
export function planImport(
  rows: ImportRowInput[],
  agencyId: string | null,
  existing: ExistingSolo[],
  existingCouples: [string, string][],
  explicitCouples: [CoupleMemberRef, CoupleMemberRef][] = [],
): ImportPlan {
  const sameAgency = new Map<string, ExistingSolo>();
  const anywhere = new Map<string, ExistingSolo[]>();
  for (const solo of existing) {
    const key = nameKey(solo.legalName);
    if (solo.agencyId === agencyId && !sameAgency.has(key)) sameAgency.set(key, solo);
    anywhere.set(key, [...(anywhere.get(key) ?? []), solo]);
  }

  const seen = new Map<string, number>();
  const planned: PlannedRow[] = rows.map((input, index) => {
    const legalName = input.legalName.trim().replace(/\s+/g, ' ');
    const chatDisplayName = (input.chatDisplayName ?? '').trim() || legalName;
    const partners = [...new Set((input.partners ?? []).map((name) => name.trim().replace(/\s+/g, ' ')).filter(Boolean))];
    const errors: string[] = [];
    if (!legalName) errors.push('영문 이름이 비어 있어요');
    if (legalName.length > MAX_LEGAL_NAME) errors.push(`영문 이름은 ${MAX_LEGAL_NAME}자까지예요`);
    if (chatDisplayName.length > MAX_CHAT_NAME) errors.push(`닉네임은 ${MAX_CHAT_NAME}자까지예요`);
    const key = nameKey(legalName);
    if (legalName && seen.has(key)) errors.push(`${seen.get(key)! + 1}번째 줄과 이름이 같아요`);
    else if (legalName) seen.set(key, index);
    if (partners.some((name) => nameKey(name) === key)) errors.push('CP 짝에 자기 이름이 있어요');
    const existingRow = legalName ? sameAgency.get(key) : undefined;
    return {
      index,
      legalName,
      chatDisplayName,
      gender: input.gender ?? null,
      partners,
      status: errors.length > 0 ? 'error' : existingRow ? 'exists' : 'new',
      ...(existingRow ? { existingId: existingRow.id } : {}),
      errors,
    };
  });

  // CP 짝 찾기: 표 안 → 같은 소속사 기존 → 다른 곳에 이름이 하나뿐인 기존
  const rowByName = new Map([...seen].map(([key, index]) => [key, planned[index]]));
  const resolve = (name: string): { ref: CoupleMemberRef; id: string | null; name: string } | string => {
    const key = nameKey(name);
    const inFile = rowByName.get(key);
    if (inFile) {
      if (inFile.status === 'exists') return { ref: { actorId: inFile.existingId! }, id: inFile.existingId!, name: inFile.legalName };
      return { ref: { row: inFile.index }, id: null, name: inFile.legalName };
    }
    const local = sameAgency.get(key);
    if (local) return { ref: { actorId: local.id }, id: local.id, name: local.legalName };
    const matches = anywhere.get(key) ?? [];
    if (matches.length === 1) return { ref: { actorId: matches[0].id }, id: matches[0].id, name: matches[0].legalName };
    if (matches.length > 1) return `CP 짝 "${name}"과 이름이 같은 아티스트가 여러 명이에요(소속사가 달라요)`;
    return `CP 짝 "${name}"을 표에서도, 등록된 아티스트에서도 찾지 못했어요`;
  };

  const coupleKeys = new Set(existingCouples.map(([a, b]) => [a, b].sort().join('|')));
  const couples: PlannedCouple[] = [];
  const plannedKeys = new Set<string>();
  for (const row of planned) {
    if (row.status === 'error') continue;
    const self = row.status === 'exists' ? { ref: { actorId: row.existingId! } as CoupleMemberRef, id: row.existingId! } : { ref: { row: row.index } as CoupleMemberRef, id: null };
    for (const partnerName of row.partners) {
      const partner = resolve(partnerName);
      if (typeof partner === 'string') {
        row.errors.push(partner);
        row.status = 'error';
        continue;
      }
      // 같은 짝을 양쪽 줄에 다 적어도 한 번만
      const refKey = (ref: CoupleMemberRef) => ('row' in ref ? `row:${ref.row}` : `id:${ref.actorId}`);
      const key = [refKey(self.ref), refKey(partner.ref)].sort().join('|');
      if (plannedKeys.has(key)) continue;
      plannedKeys.add(key);
      const exists = self.id && partner.id ? coupleKeys.has([self.id, partner.id].sort().join('|')) : false;
      couples.push({
        legalName: coupleName(row.legalName, partner.name),
        members: [self.ref, partner.ref],
        memberNames: [row.legalName, partner.name],
        status: exists ? 'exists' : 'new',
      });
    }
  }
  // 화면에서 직접 고른 CP방 — 줄 번호는 그 줄(이미 있음이면 기존 아티스트로), id는 등록된 1인 아티스트
  const byId = new Map(existing.map((solo) => [solo.id, solo]));
  const pickRef = (ref: CoupleMemberRef): { ref: CoupleMemberRef; id: string | null; name: string } | string => {
    if ('row' in ref) {
      const row = planned[ref.row];
      if (!row) return `CP방 멤버로 고른 ${ref.row + 1}번째 줄이 없어요`;
      if (row.status === 'exists') return { ref: { actorId: row.existingId! }, id: row.existingId!, name: row.legalName };
      return { ref: { row: row.index }, id: null, name: row.legalName };
    }
    const solo = byId.get(ref.actorId);
    return solo ? { ref: { actorId: solo.id }, id: solo.id, name: solo.legalName } : 'CP방 멤버로 고른 아티스트를 찾지 못했어요';
  };
  const explicitErrors: string[] = [];
  for (const [first, second] of explicitCouples) {
    const a = pickRef(first);
    const b = pickRef(second);
    if (typeof a === 'string' || typeof b === 'string') {
      explicitErrors.push(typeof a === 'string' ? a : (b as string));
      continue;
    }
    const refKey = (ref: CoupleMemberRef) => ('row' in ref ? `row:${ref.row}` : `id:${ref.actorId}`);
    if (refKey(a.ref) === refKey(b.ref)) {
      explicitErrors.push(`CP방 멤버 두 명이 같아요(${a.name})`);
      continue;
    }
    const key = [refKey(a.ref), refKey(b.ref)].sort().join('|');
    if (plannedKeys.has(key)) continue;
    plannedKeys.add(key);
    const exists = a.id && b.id ? coupleKeys.has([a.id, b.id].sort().join('|')) : false;
    couples.push({ legalName: coupleName(a.name, b.name), members: [a.ref, b.ref], memberNames: [a.name, b.name], status: exists ? 'exists' : 'new' });
  }

  // 오류가 난 줄을 짝으로 쓴 CP방은 뺌(그 줄을 고친 뒤 다시 올리면 만들어짐)
  const errorRows = new Set(planned.filter((row) => row.status === 'error').map((row) => row.index));
  const validCouples = couples.filter((couple) => couple.members.every((ref) => !('row' in ref) || !errorRows.has(ref.row)));
  return { rows: planned, couples: validCouples, coupleErrors: explicitErrors, errorCount: errorRows.size + explicitErrors.length };
}
