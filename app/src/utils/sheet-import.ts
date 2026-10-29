// 아티스트 일괄 등록(2026-10-19) — 소속사에서 받은 표(엑셀·CSV)를 등록할 줄로. 칸 이름은 한국어·영어·태국어 어느 쪽이든 알아봄.
// 쓰는 칸: 영문 이름(필수)·닉네임·성별·CP 짝. 그 밖의 칸(태국어 이름·생년월일·SNS 등)은 읽지 않음(2026-10-19 사용자 결정 — 기존 칸만).

export type ImportGender = 'FEMALE' | 'MALE' | null;

export interface SheetRow {
  legalName: string;
  chatDisplayName?: string;
  gender: ImportGender;
  partners: string[];
  /** 알아보지 못한 성별 값 등 — 미리보기에 노란 글씨로 */
  warnings: string[];
}

/** 양식 파일(CSV) — 소속사에 보낼 빈 양식 */
export const TEMPLATE_CSV = '﻿English name,Nickname,Gender (F/M),CP partner (English name; separate with ;)\nBright,,M,Win\nWin,,M,Bright\n';

const normalizeHeader = (text: string) => text.toLowerCase().replace(/[\s_\-()（）.:/]/g, '');

// 앞에 있을수록 우선(2026-10-29) — "이름"·"Name"·"ชื่อ"와 "영문 이름"이 같이 있으면 영문 이름 칸을 씀(예전엔 왼쪽 칸이 이겨서 한국어·태국어 이름이 들어갔음)
const HEADER_ALIASES: Record<'legalName' | 'chatDisplayName' | 'gender' | 'partners', string[]> = {
  legalName: ['englishname', 'nameen', 'nameenglish', '영문이름', '영문명', 'ชื่อภาษาอังกฤษ', 'ชื่ออังกฤษ', 'officialname', 'stagename', '공식이름', '활동명', 'name', '이름', 'ชื่อ'],
  chatDisplayName: ['nickname', 'nick', '닉네임', '별명', 'ชื่อเล่น'],
  gender: ['gender', 'genderfm', 'sex', '성별', 'เพศ'],
  partners: ['cp', 'cppartner', 'cppartnerenglishnameseparatewith;', 'partner', 'couple', 'cp짝', '짝', 'cp파트너', 'คู่จิ้น', 'คู่'],
};

type HeaderField = keyof typeof HEADER_ALIASES;

/** 칸 이름 → 어느 칸인지 + 우선순위(작을수록 우선) */
function headerMatch(header: string): { field: HeaderField; rank: number } | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [HeaderField, string[]][]) {
    const rank = aliases.indexOf(key);
    if (rank >= 0) return { field, rank };
  }
  // "CP partner (English name; …)"처럼 설명이 붙은 칸 — 앞부분으로. 영문 이름 설명 칸은 영문 이름급 우선순위(일반 "이름"보다 앞)
  if (key.startsWith('cp') || key.startsWith('partner')) return { field: 'partners', rank: 100 };
  if (key.startsWith('englishname') || key.startsWith('영문')) return { field: 'legalName', rank: 0.5 };
  if (key.startsWith('gender') || key.startsWith('성별')) return { field: 'gender', rank: 100 };
  if (key.startsWith('nickname') || key.startsWith('닉네임')) return { field: 'chatDisplayName', rank: 100 };
  return null;
}

const headerField = (header: string) => headerMatch(header)?.field ?? null;

const FEMALE = ['f', 'female', 'woman', 'w', '여', '여자', '여성', 'หญิง', 'ญ', 'ผู้หญิง'];
const MALE = ['m', 'male', 'man', '남', '남자', '남성', 'ชาย', 'ช', 'ผู้ชาย'];

export function parseGender(value: string): { gender: ImportGender; unknown: boolean } {
  const key = value.trim().toLowerCase();
  if (!key) return { gender: null, unknown: false };
  if (FEMALE.includes(key)) return { gender: 'FEMALE', unknown: false };
  if (MALE.includes(key)) return { gender: 'MALE', unknown: false };
  return { gender: null, unknown: true };
}

/**
 * CSV 파일 글자 읽기(2026-10-29) — 엑셀 "CSV로 저장"은 한국어 윈도우면 CP949(euc-kr), 태국어 윈도우면 Windows-874로 저장돼 UTF-8로 읽으면 이름이 조용히 깨졌음.
 * UTF-8로 먼저 읽고, 안 되면 euc-kr → windows-874 순서(한국어 바이트는 874로도 "읽혀서" 순서가 중요). 영어 아닌 글자 대부분이 그 언어 글자이고
 * 머리글을 알아볼 때만 씀. 아니면 null(→ "CSV UTF-8"로 저장해 달라고 안내)
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // 아래 다른 인코딩으로
  }
  const candidates: [string, RegExp][] = [
    ['euc-kr', /[\uAC00-\uD7A3\u3131-\u318E]/],
    ['windows-874', /[\u0E00-\u0E7F]/],
  ];
  for (const [label, script] of candidates) {
    let text: string;
    try {
      text = new TextDecoder(label, { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
    const nonAscii = [...text].filter((char) => char.charCodeAt(0) > 0x7f && char !== '\uFEFF');
    const inScript = nonAscii.filter((char) => script.test(char)).length;
    if (nonAscii.length > 0 && inScript / nonAscii.length >= 0.9 && rowsFromTable(parseCsv(text))) return text;
  }
  return null;
}

/** CSV(엑셀에서 "CSV로 저장") — 따옴표·칸 안 줄바꿈·BOM 처리, 구분자는 첫 줄을 보고 , ; 탭 중 하나 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t'].reduce((best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best), ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * 표 → 등록할 줄. 첫 줄 중 "영문 이름" 칸이 있는 줄을 머리글로 봄(위에 제목 줄이 몇 줄 있어도 됨). 머리글을 못 찾으면 null.
 * 빈 줄은 건너뜀.
 */
export function rowsFromTable(table: string[][]): { rows: SheetRow[]; ignoredColumns: string[] } | null {
  const headerIndex = table.slice(0, 10).findIndex((cells) => cells.some((cell) => headerField(cell) === 'legalName'));
  if (headerIndex < 0) return null;
  const header = table[headerIndex];
  const matches = header.map(headerMatch);
  // 같은 칸이 여러 번이면(예: "이름"과 "영문 이름") 우선순위가 높은 칸 하나만, 같으면 왼쪽(2026-10-29)
  const best = new Map<HeaderField, number>();
  matches.forEach((match, index) => {
    if (!match) return;
    const current = best.get(match.field);
    if (current === undefined || match.rank < matches[current]!.rank) best.set(match.field, index);
  });
  const columns = matches.map((match, index) => (match && best.get(match.field) === index ? match.field : null));
  const ignoredColumns = header.filter((cell, index) => cell.trim() && !columns[index]).map((cell) => cell.trim());
  const rows: SheetRow[] = [];
  for (const cells of table.slice(headerIndex + 1)) {
    if (cells.every((cell) => !cell?.trim())) continue;
    const value = (field: string) => {
      const index = columns.indexOf(field as HeaderField);
      return index >= 0 ? (cells[index] ?? '').trim() : '';
    };
    const warnings: string[] = [];
    const gender = parseGender(value('gender'));
    if (gender.unknown) warnings.push(`성별 "${value('gender')}"을 알아보지 못해 '지정 안 함'으로`);
    rows.push({
      legalName: value('legalName'),
      chatDisplayName: value('chatDisplayName') || undefined,
      gender: gender.gender,
      partners: value('partners')
        .split(/[;,/\n、]+/)
        .map((name) => name.trim())
        .filter(Boolean),
      warnings,
    });
  }
  return { rows, ignoredColumns };
}

/** 사진 파일 이름 → 비교용 이름("Bright Vachirawit.JPG" → "bright vachirawit", 밑줄·하이픈도 띄어쓰기로) */
export function photoNameKey(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
