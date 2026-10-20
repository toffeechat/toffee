import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, parseGender, photoNameKey, rowsFromTable, TEMPLATE_CSV } from './sheet-import';
import { readXlsx } from './xlsx';

describe('아티스트 일괄 등록 표 읽기', () => {
  it('엑셀: 제목 줄 건너뛰고 머리글 찾기, 태국어 성별, CP 짝 여러 명, 빈 줄 무시, 안 쓰는 칸은 따로', async () => {
    const file = readFileSync(new URL('./__fixtures__/artists.xlsx', import.meta.url));
    const table = await readXlsx(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const result = rowsFromTable(table)!;
    expect(result.ignoredColumns).toEqual(['Thai name', 'Birth date', 'Instagram']);
    expect(result.rows).toEqual([
      { legalName: 'Bright', chatDisplayName: undefined, gender: 'MALE', partners: ['Win'], warnings: [] },
      { legalName: 'Win', chatDisplayName: 'Win M', gender: 'MALE', partners: ['Bright', 'Mew'], warnings: [] },
      { legalName: 'Ploy & <Co>', chatDisplayName: undefined, gender: 'FEMALE', partners: [], warnings: [] },
    ]);
  });

  it('CSV: 따옴표·칸 안 쉼표·BOM, 세미콜론 구분 엑셀도', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
    expect(parseCsv('영문 이름;성별\nBright;남')).toEqual([
      ['영문 이름', '성별'],
      ['Bright', '남'],
    ]);
  });

  it('양식 파일은 그대로 읽힘', () => {
    const result = rowsFromTable(parseCsv(TEMPLATE_CSV))!;
    expect(result.ignoredColumns).toEqual([]);
    expect(result.rows.map((row) => [row.legalName, row.gender, row.partners])).toEqual([
      ['Bright', 'MALE', ['Win']],
      ['Win', 'MALE', ['Bright']],
    ]);
  });

  it('성별을 못 알아보면 지정 안 함 + 경고, 머리글이 없으면 null', () => {
    expect(parseGender('여')).toEqual({ gender: 'FEMALE', unknown: false });
    expect(parseGender('')).toEqual({ gender: null, unknown: false });
    const result = rowsFromTable([['Name', 'Gender'], ['Mew', 'x']])!;
    expect(result.rows[0]).toMatchObject({ gender: null, warnings: [expect.stringContaining('"x"')] });
    expect(rowsFromTable([['foo', 'bar']])).toBeNull();
  });

  it('사진 파일 이름 맞추기', () => {
    expect(photoNameKey('Bright_Vachirawit.JPG')).toBe('bright vachirawit');
    expect(photoNameKey(' Win-Metawin .png')).toBe('win metawin');
  });
});
