#!/usr/bin/env node
// OTA 내려보내기(2026-10-15) — `npm run ota -- preview "무엇을 고쳤는지"`
//
// eas update는 eas.json 빌드 프로필의 env(EXPO_PUBLIC_API_URL 등)를 읽지 않음 — 그대로 돌리면 데모 서버 주소·로그인 키가 빠진 채
// 묶여서, 업데이트를 받은 앱이 엉뚱한 서버로 붙음. 그래서 이 스크립트가 같은 이름의 빌드 프로필 env를 넣고 돌림(빌드와 똑같은 값).
// EAS 서버에 둔 비밀 값(네이버 시크릿 등)은 --environment로 같이 받음. 채널 = 프로필 이름(eas.json의 channel).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [profileName, ...messageParts] = process.argv.slice(2);
const message = messageParts.join(' ').trim();
const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const profile = eas.build?.[profileName];

if (!profile || !profile.channel || !message) {
  console.error('사용법: npm run ota -- <preview|production> "무엇을 고쳤는지"');
  console.error('채널이 있는 프로필:', Object.keys(eas.build ?? {}).filter((name) => eas.build[name].channel).join(', '));
  process.exit(1);
}

// 프로필이 extends로 다른 프로필을 이으면 그 env도(eas.json 규칙과 같게 자식이 덮어씀)
const envOf = (name) => {
  const p = eas.build[name];
  return { ...(p.extends ? envOf(p.extends) : {}), ...(p.env ?? {}) };
};

const result = spawnSync(
  'npx',
  ['--yes', 'eas-cli@latest', 'update', '--channel', profile.channel, '--environment', profileName, '--message', message, '--non-interactive'],
  { cwd: root, stdio: 'inherit', env: { ...process.env, ...envOf(profileName) } },
);
process.exit(result.status ?? 1);
