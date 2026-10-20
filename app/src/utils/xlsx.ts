// 엑셀(.xlsx) 첫 번째 시트를 표(문자열 2차원 배열)로 — 아티스트 일괄 등록(2026-10-19)용. 라이브러리 없이 브라우저 기본 기능만:
// .xlsx는 zip 안의 XML이라 zip 목차를 읽고(DecompressionStream 'deflate-raw'로 풀고) 시트 XML에서 칸 값만 꺼냄. 수식은 저장된 결과값,
// 날짜·서식은 무시(이름·성별·CP 짝만 읽으므로). 운영자 PC 웹 전용(최신 크롬·사파리·엣지).

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // 끝에서 "중앙 목차 끝" 표시(0x06054b50)를 찾음
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('엑셀 파일이 아니에요');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('엑셀 파일이 손상됐어요');
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true);
  const data = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error('지원하지 않는 압축 방식이에요');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** <t>…</t> 조각을 이어 붙임(서식이 섞인 글은 <r><t>가</t></r><r><t>나</t></r>처럼 나뉨) */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('');

/** "AB12" → 27(0부터) */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const entries = readEntries(bytes);
  const find = (name: string) => entries.find((entry) => entry.name === name);
  // 첫 번째 시트 — 보통 sheet1.xml(시트 순서를 바꿨어도 workbook의 첫 시트가 sheet1인 경우가 대부분)
  const sheet = find('xl/worksheets/sheet1.xml') ?? entries.find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
  if (!sheet) throw new Error('시트를 찾지 못했어요');
  const sharedEntry = find('xl/sharedStrings.xml');
  const shared = sharedEntry ? [...(await readEntry(bytes, sharedEntry)).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1])) : [];
  const xml = await readEntry(bytes, sheet);
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    let next = 0;
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : next;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const value = type === 's' ? (shared[Number(raw)] ?? '') : type === 'inlineStr' ? textOf(body) : raw !== undefined ? decodeXml(raw) : '';
      while (row.length < index) row.push('');
      row[index] = value;
      next = index + 1;
    }
    rows.push(row);
  }
  return rows;
}
