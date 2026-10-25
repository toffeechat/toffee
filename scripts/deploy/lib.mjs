// 배포 스크립트 공용(2026-10-25) — 외부 패키지 없이 Node 22만으로 돌게(워크플로·Claude 세션·사용자 PC 어디서나)
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const ENVIRONMENTS = {
  preview: {
    label: '프리뷰(데모)',
    api: 'https://api-demo.toffeechat.app',
    web: 'https://demo.toffeechat.app',
    otaChannel: 'preview',
    sentryEnvironments: { backend: 'demo', app: 'preview' },
  },
  production: {
    label: '프로덕션(운영)',
    api: 'https://api.toffeechat.app',
    web: 'https://app.toffeechat.app',
    otaChannel: 'production',
    sentryEnvironments: { backend: 'production', app: 'production' },
  },
};

export function envConfig(name) {
  const config = ENVIRONMENTS[name];
  if (!config) throw new Error(`환경 이름은 preview 또는 production: ${name}`);
  // 주소는 워크플로 변수로 덮어쓸 수 있게(운영 주소가 바뀌거나 임시 주소로 먼저 띄울 때)
  return {
    ...config,
    api: (process.env.DEPLOY_API_URL || config.api).replace(/\/$/, ''),
    web: (process.env.DEPLOY_WEB_URL || config.web).replace(/\/$/, ''),
  };
}

export function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key.slice(2)] = true;
    else {
      out[key.slice(2)] = next;
      i++;
    }
  }
  return out;
}

export function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function tryGit(...gitArgs) {
  try {
    return git(...gitArgs);
  } catch {
    return null;
  }
}

export const commitExists = (sha) => !!sha && tryGit('cat-file', '-e', `${sha}^{commit}`) !== null;

// deployed가 target을 포함하면(같거나 더 새 커밋) true
export function contains(deployed, target) {
  if (!deployed || !commitExists(deployed)) return false;
  return tryGit('merge-base', '--is-ancestor', target, deployed) !== null;
}

export async function fetchJson(url, { timeoutMs = 10_000, ...init } = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // 웹(SPA)은 없는 주소도 index.html로 200을 줌 — JSON이 아니면 null
  }
  return { status: response.status, ok: response.ok, body, text };
}

// 지금 떠 있는 서버·웹의 커밋(모르면 null — 이 기능이 들어가기 전 배포본이거나 접속 실패)
export async function liveCommits(config) {
  const read = async (url) => {
    try {
      const { body } = await fetchJson(url);
      return typeof body?.commit === 'string' && /^[0-9a-f]{7,40}$/.test(body.commit) ? body.commit : null;
    } catch {
      return null;
    }
  };
  const [server, web] = await Promise.all([read(`${config.api}/health`), read(`${config.web}/version.json?t=${Date.now()}`)]);
  return { server, web };
}

export function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

export function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const short = (sha) => (sha ? sha.slice(0, 7) : '없음');
