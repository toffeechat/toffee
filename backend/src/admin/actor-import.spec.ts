import { describe, expect, it } from 'vitest';
import { coupleName, nameKey, planImport, type ExistingSolo } from './actor-import.js';

const EXISTING: ExistingSolo[] = [
  { id: 'old-1', legalName: 'Mew', agencyId: 'gmm' },
  { id: 'old-2', legalName: 'Gulf', agencyId: 'other' },
  { id: 'dup-a', legalName: 'Nani', agencyId: 'a' },
  { id: 'dup-b', legalName: 'Nani', agencyId: 'b' },
];

describe('아티스트 일괄 등록 계획', () => {
  it('새 줄·이미 있는 줄·닉네임 기본값(영문 이름)·이름 공백 정리', () => {
    const plan = planImport(
      [{ legalName: '  Bright   Vachirawit ', gender: 'MALE' }, { legalName: 'mew', chatDisplayName: 'Mew Suppasit' }],
      'gmm',
      EXISTING,
      [],
    );
    expect(plan.errorCount).toBe(0);
    expect(plan.rows[0]).toMatchObject({ legalName: 'Bright Vachirawit', chatDisplayName: 'Bright Vachirawit', gender: 'MALE', status: 'new' });
    // 같은 소속사에 같은 이름(대소문자 무시) → 건너뜀
    expect(plan.rows[1]).toMatchObject({ status: 'exists', existingId: 'old-1' });
  });

  it('CP 짝: 양쪽 줄에 다 적어도 CP방은 하나, 이름은 "A & B"', () => {
    const plan = planImport([{ legalName: 'Bright', partners: ['Win'] }, { legalName: 'Win', partners: ['bright'] }], 'gmm', EXISTING, []);
    expect(plan.couples).toEqual([{ legalName: 'Bright & Win', members: [{ row: 0 }, { row: 1 }], memberNames: ['Bright', 'Win'], status: 'new' }]);
  });

  it('CP 짝을 표 밖에서: 같은 소속사 → 다른 곳에 하나뿐인 이름, 여러 명이면 오류', () => {
    const plan = planImport(
      [
        { legalName: 'Tharn', partners: ['Mew'] },
        { legalName: 'Type', partners: ['Gulf'] },
        { legalName: 'Off', partners: ['Nani'] },
        { legalName: 'Gun', partners: ['Nobody'] },
      ],
      'gmm',
      EXISTING,
      [],
    );
    expect(plan.couples.map((couple) => couple.members)).toEqual([
      [{ row: 0 }, { actorId: 'old-1' }],
      [{ row: 1 }, { actorId: 'old-2' }],
    ]);
    expect(plan.rows[2].status).toBe('error');
    expect(plan.rows[2].errors[0]).toContain('여러 명');
    expect(plan.rows[3].errors[0]).toContain('찾지 못했어요');
    expect(plan.errorCount).toBe(2);
  });

  it('이미 있는 두 사람의 CP방은 "이미 있음"', () => {
    const plan = planImport([{ legalName: 'Mew', partners: ['Gulf'] }], 'gmm', EXISTING, [['old-2', 'old-1']]);
    expect(plan.couples[0]).toMatchObject({ status: 'exists', members: [{ actorId: 'old-1' }, { actorId: 'old-2' }] });
  });

  it('오류: 빈 이름·표 안 중복·자기 자신을 짝으로·너무 긴 이름 — 오류 줄을 짝으로 쓴 CP방은 뺌', () => {
    const plan = planImport(
      [
        { legalName: '' },
        { legalName: 'Win', partners: ['Bright'] },
        { legalName: 'WIN' },
        { legalName: 'Bright', partners: ['Bright'] },
        { legalName: 'x'.repeat(101) },
      ],
      null,
      [],
      [],
    );
    expect(plan.rows.map((row) => row.status)).toEqual(['error', 'new', 'error', 'error', 'error']);
    expect(plan.rows[2].errors[0]).toContain('2번째 줄');
    expect(plan.couples).toEqual([]);
    expect(plan.errorCount).toBe(4);
  });

  it('이름 비교·CP 이름', () => {
    expect(nameKey('  Bright  WIN ')).toBe('bright win');
    expect(coupleName('Bright', 'Win')).toBe('Bright & Win');
  });
});

describe('화면에서 고른 CP방(2026-10-20)', () => {
  const existing: ExistingSolo[] = [
    { id: 'a', legalName: 'Old A', agencyId: 'x' },
    { id: 'b', legalName: 'Old B', agencyId: 'y' },
  ];

  it('새 줄 + 기존 아티스트, 기존 둘끼리(줄 없이도), 같은 쌍은 한 번만', () => {
    const plan = planImport([{ legalName: 'New', partners: ['Old A'] }], null, existing, [], [
      [{ row: 0 }, { actorId: 'a' }],
      [{ actorId: 'a' }, { actorId: 'b' }],
    ]);
    expect(plan.couples.map((couple) => couple.legalName)).toEqual(['New & Old A', 'Old A & Old B']);
    expect(plan.errorCount).toBe(0);
  });

  it('이미 있는 CP는 건너뛰고, 같은 사람 둘·없는 줄은 오류', () => {
    const plan = planImport([], null, existing, [['a', 'b']], [
      [{ actorId: 'b' }, { actorId: 'a' }],
      [{ actorId: 'a' }, { actorId: 'a' }],
      [{ row: 3 }, { actorId: 'a' }],
    ]);
    expect(plan.couples).toMatchObject([{ status: 'exists' }]);
    expect(plan.coupleErrors).toHaveLength(2);
    expect(plan.errorCount).toBe(2);
  });
});
