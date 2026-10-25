#!/usr/bin/env node
// 배포를 피할 시간인지(2026-10-25, policy.json) — 막히면 이유를 찍고 종료 코드 1. --override면 경고만(급한 장애 수정).
//   node scripts/deploy/check-window.mjs --env preview [--at 2026-11-03T13:30:00+07:00] [--override]
import { join } from 'node:path';
import { args, readJson, repoRoot, summary } from './lib.mjs';

const opts = args();
const env = opts.env || 'preview';
const policy = readJson(join(repoRoot, 'scripts', 'deploy', 'policy.json'));
const now = opts.at ? new Date(opts.at) : new Date();

// 정책 시간대의 "HH:MM"(분 단위)
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: policy.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
const minutes = Number(parts.find((p) => p.type === 'hour').value) * 60 + Number(parts.find((p) => p.type === 'minute').value);
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const inRange = ({ from, to }) => {
  const [a, b] = [toMinutes(from), toMinutes(to)];
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b; // 자정을 넘는 구간(19:00~01:00)
};

const blocks = [
  ...(policy.quietHours?.[env] ?? []).filter(inRange).map((q) => `${q.from}~${q.to}(${policy.timezone}) ${q.reason}`),
  ...(policy.freezes ?? [])
    .filter((f) => (f.env ?? 'preview') === env && new Date(f.from) <= now && now < new Date(f.to))
    .map((f) => `${f.from} ~ ${f.to} ${f.reason}`),
];

if (!blocks.length) {
  console.log(`배포 가능 시간(${env})`);
  process.exit(0);
}
const text = blocks.map((b) => `- ${b}`).join('\n');
if (opts.override) {
  console.log(`⚠️ 배포를 피할 시간이지만 override로 진행:\n${text}`);
  summary(`> ⚠️ 배포를 피할 시간이지만 override로 진행\n${text}\n`);
  process.exit(0);
}
console.error(`⛔ 지금은 ${env} 배포를 피할 시간:\n${text}\n(급한 장애 수정이면 override 입력으로 다시 실행)`);
summary(`> ⛔ 배포를 피할 시간이라 멈춤\n${text}\n`);
process.exit(1);
