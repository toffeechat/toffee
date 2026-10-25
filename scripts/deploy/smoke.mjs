#!/usr/bin/env node
// 배포 후 자동 점검(스모크 테스트, 2026-10-25) — 헬스 → 로그인 → 메시지 보내기·받기·답장 → 정리(회수), 웹 첫 화면.
// 점검 전용 계정·숨긴 대화방(backend/src/smoke)을 쓰므로 데모·운영 회원에게 보이거나 알림이 가지 않음.
//   SMOKE_TEST_SECRET=… node scripts/deploy/smoke.mjs --env preview [--expect-commit <sha>] [--skip-web] [--require-login]
// 결과는 표로 출력(+ GitHub 요약). 하나라도 실패하면 종료 코드 1.
import { args, contains, envConfig, fetchJson, short, summary } from './lib.mjs';

const opts = args();
const envName = opts.env || 'preview';
const config = envConfig(envName);
const secret = process.env.SMOKE_TEST_SECRET?.trim();
const results = [];
const stamp = `${new Date().toISOString()} ${short(opts['expect-commit'] || process.env.GITHUB_SHA || '')}`;

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = (await fn()) ?? '';
    results.push({ name, ok: true, detail, ms: Date.now() - started });
    return true;
  } catch (error) {
    results.push({ name, ok: false, detail: error.message, ms: Date.now() - started });
    return false;
  }
}

async function api(method, path, { token, body, expect = [200, 201, 204], headers = {} } = {}) {
  const res = await fetchJson(`${config.api}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-client-platform': 'smoke',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    timeoutMs: 15_000,
  });
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${res.text.slice(0, 160)}`);
  return res.body;
}

await step('서버 살아 있음(/health)', async () => {
  const body = await api('GET', '/health');
  const expected = opts['expect-commit'];
  // 그사이 main에 더 새 커밋이 배포됐으면(이 커밋을 포함) 통과
  if (expected && body?.commit && !body.commit.startsWith(expected) && !contains(body.commit, expected)) {
    throw new Error(`떠 있는 커밋 ${short(body.commit)} ≠ 기대 ${short(expected)}`);
  }
  return `커밋 ${short(body?.commit)}`;
});
await step('DB 연결(/health/ready)', async () => {
  await api('GET', '/health/ready');
  return 'ok';
});

let session = null;
if (!secret) {
  // 프로덕션(--require-login)은 실패, 프리뷰는 설정 전이면 경고만(헬스·웹 점검은 그대로)
  const detail = 'SMOKE_TEST_SECRET이 없음 — GitHub Secrets와 서버(Railway) 변수에 같은 값을 넣어야 로그인·메시지 점검이 돎';
  results.push({ name: '로그인·메시지', ok: !opts['require-login'], skipped: true, detail, ms: 0 });
} else {
  await step('로그인(점검 계정 토큰 발급)', async () => {
    session = await api('POST', '/smoke/session', { headers: { 'x-smoke-secret': secret } });
    if (!session?.fanToken || !session?.artistToken) throw new Error('토큰이 안 옴');
    return '아티스트·팬 토큰';
  });
}

if (session) {
  const { actorId, fanToken, artistToken } = session;
  let broadcastId = null;
  let replyId = null;
  await step('로그인 확인(/auth/me)', async () => {
    const me = await api('GET', '/auth/me', { token: fanToken });
    if (!me?.id) throw new Error('회원 정보가 없음');
    return 'ok';
  });
  const sent = await step('아티스트 메시지 보내기', async () => {
    // silent: 푸시 없이(점검 대화방엔 알림 받을 기기도 없음)
    const message = await api('POST', `/actors/${actorId}/messages/broadcast`, {
      token: artistToken,
      body: { mediaType: 'TEXT', body: `[자동 점검] ${stamp}`, silent: true },
    });
    broadcastId = message?.id;
    if (!broadcastId) throw new Error('메시지 id가 없음');
    return 'ok';
  });
  if (sent) {
    await step('팬이 메시지 받기', async () => {
      const list = await api('GET', `/actors/${actorId}/messages?limit=10`, { token: fanToken });
      const items = Array.isArray(list) ? list : (list?.items ?? list?.messages ?? []);
      if (!items.some((m) => m.id === broadcastId)) throw new Error('보낸 메시지가 팬 목록에 없음');
      return 'ok';
    });
    await step('팬 답장 보내기', async () => {
      const reply = await api('POST', `/actors/${actorId}/messages/reply`, { token: fanToken, body: { body: `[자동 점검] 답장 ${stamp}` } });
      replyId = reply?.id;
      if (!replyId) throw new Error('답장 id가 없음');
      return 'ok';
    });
  }
  // 정리 — 실패해도 점검 결과엔 경고만(다음 점검 때 하루 지난 메시지는 서버가 지움)
  for (const [id, token] of [
    [replyId, fanToken],
    [broadcastId, artistToken],
  ]) {
    if (!id) continue;
    try {
      await api('DELETE', `/actors/${actorId}/messages/${id}`, { token });
    } catch (error) {
      console.warn(`정리 실패(무시): ${error.message}`);
    }
  }
}

if (!opts['skip-web']) {
  await step('웹 첫 화면', async () => {
    const res = await fetchJson(`${config.web}/?smoke=${Date.now()}`, { timeoutMs: 15_000 });
    if (!res.ok || !/<div id="root"|<script/i.test(res.text)) throw new Error(`${res.status} — 화면 HTML이 아님`);
    const version = await fetchJson(`${config.web}/version.json?t=${Date.now()}`);
    return `커밋 ${short(version.body?.commit)}`;
  });
}

const failed = results.filter((r) => !r.ok);
const table = [
  `### ${config.label} 자동 점검 — ${failed.length ? `⛔ ${failed.length}개 실패` : results.some((r) => r.skipped) ? '⚠️ 통과(일부 건너뜀)' : '✅ 모두 통과'}`,
  '',
  '| 점검 | 결과 | 내용 | 시간 |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.skipped && r.ok ? '⚠️ 건너뜀' : r.ok ? '✅' : '⛔'} | ${String(r.detail).replace(/\|/g, '/').slice(0, 200)} | ${r.ms}ms |`),
].join('\n');
console.log(table);
summary(table);
process.exit(failed.length ? 1 : 0);
