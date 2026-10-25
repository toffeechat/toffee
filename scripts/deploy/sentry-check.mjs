#!/usr/bin/env node
// 배포 직후 새로 생긴 오류(2026-10-25) — Sentry에서 최근 N분 안에 처음 생긴 미해결 이슈를 서버·앱 프로젝트별로. 배포를 실패로 만들진
// 않고 보고만(새 오류가 배포 때문인지는 사람이 봄). SENTRY_AUTH_TOKEN(읽기 권한 project:read·event:read)이 없으면 건너뜀.
//   node scripts/deploy/sentry-check.mjs --env preview [--minutes 30]
import { args, envConfig, fetchJson, summary } from './lib.mjs';

const opts = args();
const config = envConfig(opts.env || 'preview');
const token = process.env.SENTRY_AUTH_TOKEN?.trim();
const org = process.env.SENTRY_ORG || 'toffeechat';
const minutes = Number(opts.minutes || 30);

if (!token) {
  const text = '> Sentry 확인 건너뜀 — GitHub Secrets에 `SENTRY_AUTH_TOKEN`이 없음(ops-infra-backlog "배포 자동화")';
  console.log(text);
  summary(text);
  process.exit(0);
}

const projects = [
  ['서버', 'toffee-backend', config.sentryEnvironments.backend],
  ['앱·웹', 'toffee-app', config.sentryEnvironments.app],
];
const lines = [`### Sentry — 최근 ${minutes}분 새 오류`, ''];
for (const [label, project, environment] of projects) {
  const query = encodeURIComponent(`is:unresolved firstSeen:-${minutes}m`);
  const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=${query}&environment=${environment}&statsPeriod=24h`;
  try {
    const res = await fetchJson(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const issues = Array.isArray(res.body) ? res.body : [];
    lines.push(`- ${label}(${project}, ${environment}): ${issues.length ? `⚠️ ${issues.length}건` : '✅ 없음'}`);
    for (const issue of issues.slice(0, 5)) lines.push(`  - ${issue.title} — ${issue.count}회 ${issue.permalink ?? ''}`);
  } catch (error) {
    lines.push(`- ${label}(${project}): 확인 실패 ${error.message}`);
  }
}
const text = lines.join('\n');
console.log(text);
summary(text);
