#!/usr/bin/env node
// 웹 빌드에 커밋 표시(2026-10-25 배포 체계) — dist/version.json. 배포 워크플로가 "이 커밋이 정말 올라갔는지" 확인하고 다음 배포 때
// 무엇이 바뀌었는지 계산하는 데 씀. Cloudflare Pages(GitHub 연결 빌드)는 CF_PAGES_COMMIT_SHA, GitHub Actions는 GITHUB_SHA를 줌
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fromGit = () => {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const commit = process.env.WEB_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || fromGit();
writeFileSync(join(root, 'dist', 'version.json'), `${JSON.stringify({ commit, builtAt: new Date().toISOString() })}\n`);
console.log(`dist/version.json: ${commit}`);
