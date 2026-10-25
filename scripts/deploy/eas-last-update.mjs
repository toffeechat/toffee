#!/usr/bin/env node
// 이 채널에 마지막으로 보낸 OTA의 git 커밋(2026-10-25) — plan.mjs의 OTA 기준. EXPO_TOKEN이 있는 곳(워크플로)에서만 동작, 모르면 빈 출력.
//   node scripts/deploy/eas-last-update.mjs --channel preview
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { args, output, repoRoot } from './lib.mjs';

const opts = args();
const branch = opts.channel || 'preview'; // ota.mjs는 채널 = 브랜치 이름으로 보냄(eas update --channel이 같은 이름 브랜치를 씀)
let commit = '';
try {
  const raw = execFileSync('npx', ['--yes', 'eas-cli@latest', 'update:list', '--branch', branch, '--json', '--non-interactive', '--limit', '5'], {
    cwd: join(repoRoot, 'app'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 출력 모양이 eas-cli 버전마다 조금 달라서 gitCommitHash 키를 아무 깊이에서나 찾음(첫 번째 = 가장 최근)
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (typeof node.gitCommitHash === 'string') return node.gitCommitHash;
    for (const value of Object.values(node)) {
      const hit = find(value);
      if (hit) return hit;
    }
    return null;
  };
  // JSON 앞에 안내 문구가 붙는 버전이 있어서 처음 나오는 { 또는 [부터
  const start = Math.min(...['{', '['].map((ch) => raw.indexOf(ch)).filter((i) => i >= 0));
  commit = find(JSON.parse(raw.slice(start))) ?? '';
} catch (error) {
  console.error(`마지막 OTA를 못 읽음(무시): ${String(error.message).split('\n')[0]}`);
}
console.log(commit);
output('commit', commit);
