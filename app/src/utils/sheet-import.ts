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

const HEADER_ALIASES: Record<'legalName' | 'chatDisplayName' | 'gender' | 'partners', string[]> = {
  legalName: ['englishname', 'nameen', 'nameenglish', 'name', 'officialname', 'stagename', '영문이름', '영문명', '이름', '공식이름', '활동명', 'ชื่อภาษาอังกฤษ', 'ชื่ออังกฤษ', 'ชื่อ'],
  chatDisplayName: ['nickname', 'nick', '닉네임', '별명', 'ชื่อเล่น'],
  gender: ['gender', 'genderfm', 'sex', '성별', 'เพศ'],
  partners: ['cp', 'cppartner', 'cppartnerenglishnameseparatewith;', 'partner', 'couple', 'cp짝', '짝', 'cp파트너', 'คู่จิ้น', 'คู่'],
};

function headerField(header: string): keyof typeof HEADER_ALIASES | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
    if (aliases.includes(key)) return field;
  }
  // "CP partner (English name; …)"처럼 설명이 붙은 칸 — 앞부분으로
  if (key.startsWith('cp') || key.startsWith('partner')) return 'partners';
  if (key.startsWith('englishname') || key.startsWith('영문')) return 'legalName';
  if (key.startsWith('gender') || key.startsWith('성별')) return 'gender';
  if (key.startsWith('nickname') || key.startsWith('닉네임')) return 'chatDisplayName';
  return null;
}

const FEMALE = ['f', 'female', 'woman', 'w', '여', '여자', '여성', 'หญิง', 'ญ', 'ผู้หญิง'];
const MALE = ['m', 'male', 'man', '남', '남자', '남성', 'ชาย', 'ช', 'ผู้ชาย'];

export function parseGender(value: string): { gender: ImportGender; unknown: boolean } {
  const key = value.trim().toLowerCase();
  if (!key) return { gender: null, unknown: false };
  if (FEMALE.includes(key)) return { gender: 'FEMALE', unknown: false };
  if (MALE.includes(key)) return { gender: 'MALE', unknown: false };
  return { gender: null, unknown: true };
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
  const fields = header.map(headerField);
  // 같은 칸이 두 번이면(예: "이름"과 "영문 이름") 앞쪽만
  const seen = new Set<string>();
  const columns = fields.map((field) => {
    if (!field || seen.has(field)) return null;
    seen.add(field);
    return field;
  });
  const ignoredColumns = header.filter((cell, index) => cell.trim() && !columns[index]).map((cell) => cell.trim());
  const rows: SheetRow[] = [];
  for (const cells of table.slice(headerIndex + 1)) {
    if (cells.every((cell) => !cell?.trim())) continue;
    const value = (field: string) => {
      const index = columns.indexOf(field as keyof typeof HEADER_ALIASES);
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
