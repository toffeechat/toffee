#!/usr/bin/env node
// 이 채널에 마지막으로 보낸 OTA의 git 커밋(2026-10-25) — plan.mjs의 OTA 기준. EXPO_TOKEN이 있는 곳(워크플로)에서만 동작, 모르면 빈 출력.
//   node scripts/deploy/eas-last-update.mjs --channel preview
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { args, output, repoRoot } from './lib.mjs';

const opts = args();
const branch = opts.channel || 'preview'; // ota.mjs는 채널 = 브랜치 이름으로 보냄(eas update --channel이 같은 이름 브랜치를 씀)
let commit = '';
const eas = (...cmd) =>
  execFileSync('npx', ['--yes', 'eas-cli@latest', ...cmd], { cwd: join(repoRoot, 'app'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// JSON 앞에 안내 문구가 붙는 버전이 있어서 처음 나오는 { 또는 [부터
const parse = (raw) => JSON.parse(raw.slice(Math.min(...['{', '['].map((ch) => raw.indexOf(ch)).filter((i) => i >= 0))));
// 출력 모양이 eas-cli 버전마다 조금 달라서 키를 아무 깊이에서나 찾음(첫 번째 = 가장 최근)
const find = (node, key) => {
  if (!node || typeof node !== 'object') return null;
  if (typeof node[key] === 'string') return node[key];
  for (const value of Object.values(node)) {
    const hit = find(value, key);
    if (hit) return hit;
  }
  return null;
};
try {
  const list = parse(eas('update:list', '--branch', branch, '--json', '--non-interactive', '--limit', '5'));
  // 2026-10-25: update:list(브랜치 지정)는 gitCommitHash를 안 줌 — 가장 최근 묶음(group)을 update:view로 다시 읽어서 커밋을 얻음
  commit = find(list, 'gitCommitHash') ?? '';
  const group = commit ? null : find(list, 'group');
  if (group) commit = find(parse(eas('update:view', group, '--json')), 'gitCommitHash') ?? '';
} catch (error) {
  console.error(`마지막 OTA를 못 읽음(무시): ${String(error.message).split('\n')[0]}`);
  // 왜 실패했는지(권한·로그인·채널 없음 등) — eas-cli가 알려 준 마지막 몇 줄(첫 줄만으론 원인을 알 수 없었음)
  const detail = String(error.stderr || error.stdout || '').trim().split('\n').slice(-8).join('\n');
  if (detail) console.error(detail);
}
console.log(commit);
output('commit', commit);
