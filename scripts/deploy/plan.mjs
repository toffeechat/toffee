#!/usr/bin/env node
// 배포 계획(2026-10-25) — "지금 떠 있는 것"과 올릴 커밋을 비교해서 무엇을 올려야 하는지 정함. 배포 워크플로와 Claude(deploy 스킬)가
// 똑같이 씀: 사람이 "프리뷰에 반영해"처럼 정해진 말을 하지 않아도, 바뀐 파일로 서버·마이그레이션·웹·OTA·새 빌드를 판단.
//
//   node scripts/deploy/plan.mjs --env preview [--target <커밋|브랜치>] [--ota-base <커밋>] [--json plan.json]
//
// 기준(이전 배포본): 서버 = 떠 있는 서버 /health의 commit, 웹 = 웹 /version.json, OTA = --ota-base(워크플로가 EAS에서 읽어 넘김)
// → 서버·웹은 모르면 git 태그 deployed/<환경>(배포 워크플로가 성공할 때마다 옮김) → 그것도 없으면 "처음"으로 보고 전부 올림.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { args, commitExists, envConfig, git, liveCommits, output, repoRoot, short, summary, tryGit } from './lib.mjs';

const opts = args();
const envName = opts.env || 'preview';
const config = envConfig(envName);
const target = git('rev-parse', `${opts.target || 'HEAD'}^{commit}`);
const tag = tryGit('rev-parse', '--verify', '--quiet', `refs/tags/deployed/${envName}^{commit}`);
const live = opts.offline ? { server: null, web: null } : await liveCommits(config);
const known = (sha) => (sha && commitExists(sha) ? git('rev-parse', `${sha}^{commit}`) : null);
const bases = {
  server: known(opts['server-base']) || known(live.server) || known(tag),
  web: known(opts['web-base']) || known(live.web) || known(tag),
  // OTA는 태그로 짐작하지 않음 — OTA를 못 한 채(EXPO_TOKEN 없음) 태그만 옮겨졌을 수 있어서. EAS의 마지막 OTA 커밋만 믿음
  ota: known(opts['ota-base']),
};

const changed = (base, to = target) => (base ? git('diff', '--name-only', base, to).split('\n').filter(Boolean) : null);
const isDoc = (file) => file.endsWith('.md');

// ── 서버: backend/ 아래(문서 제외). Railway 감시 경로(backend/railway.json watchPatterns)와 같은 기준
const serverFile = (file) => file.startsWith('backend/') && !isDoc(file);

// ── 앱·웹: app/ 아래 중 화면에 안 들어가는 것 제외
const APP_NOT_SHIPPED = [/^app\/e2e\//, /^app\/scripts\//, /\.test\.tsx?$/, /^app\/vitest\.config\.ts$/, /^app\/eslint\.config\.js$/, /^app\/LICENSE$/];
const appFile = (file) => file.startsWith('app/') && !isDoc(file) && !APP_NOT_SHIPPED.some((re) => re.test(file));
// 웹 전용 정적 파일(OTA엔 안 들어감)
const webOnlyFile = (file) => file.startsWith('app/public/');

// ── 네이티브(새 빌드가 필요한 것) — OTA로 못 보냄
const NATIVE_PATHS = [
  /^app\/plugins\//,
  /^app\/locales\//, // iOS 권한 안내 문구(앱 화면 번역은 src/i18n)
  /^app\/ios\//,
  /^app\/android\//,
  /^app\/GoogleService-Info.*\.plist$/,
  /^app\/google-services.*\.json$/,
  /^app\/assets\/images\/(icon|splash|android-icon|adaptive-icon)/, // 앱 아이콘·시작 화면
];

function commentOnlyDiff(base, to, file) {
  const lines = git('diff', '-U0', base, to, '--', file)
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    .map((line) => line.slice(1).trim());
  return lines.every((line) => line === '' || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*'));
}

const showJson = (sha, file) => {
  const text = tryGit('show', `${sha}:${file}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

// 설치된 패키지에 iOS·안드로이드 코드가 있으면 네이티브. 설치 전이면 이름으로 짐작(모르면 네이티브 쪽으로 — 잘못 OTA하면 앱이 꺼짐)
function nativePackage(name) {
  const dir = join(repoRoot, 'app', 'node_modules', name);
  if (existsSync(join(dir, 'package.json'))) {
    return ['ios', 'android', 'expo-module.config.json', 'react-native.config.js'].some((entry) => existsSync(join(dir, entry)));
  }
  return /^(expo-|@expo\/|react-native|@react-native|@sentry\/react-native|@xmartlabs\/react-native)/.test(name) || name === 'expo';
}

function nativeDependencyChanges(base, to) {
  const before = showJson(base, 'app/package-lock.json')?.packages ?? {};
  const after = showJson(to, 'app/package-lock.json')?.packages ?? {};
  const names = new Set();
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!key.startsWith('node_modules/') || before[key]?.version === after[key]?.version) continue;
    names.add(key.replace(/^.*node_modules\//, ''));
  }
  // 잠금 파일 없이 package.json만 바뀐 경우도(정상이면 같이 바뀜)
  const deps = (sha) => showJson(sha, 'app/package.json')?.dependencies ?? {};
  const [depsBefore, depsAfter] = [deps(base), deps(to)];
  for (const name of new Set([...Object.keys(depsBefore), ...Object.keys(depsAfter)])) {
    if (depsBefore[name] !== depsAfter[name]) names.add(name);
  }
  return [...names].filter(nativePackage).sort();
}

function nativeReasons(base, to) {
  const files = changed(base, to) ?? [];
  const reasons = files.filter((file) => NATIVE_PATHS.some((re) => re.test(file))).map((file) => `${file} 변경`);
  if (files.includes('app/app.config.ts') && !commentOnlyDiff(base, to, 'app/app.config.ts')) reasons.push('app/app.config.ts(앱 설정·버전) 변경');
  if (files.some((file) => file === 'app/package.json' || file === 'app/package-lock.json')) {
    const natives = nativeDependencyChanges(base, to);
    if (natives.length) reasons.push(`네이티브 패키지 변경: ${natives.slice(0, 8).join(', ')}${natives.length > 8 ? ` 외 ${natives.length - 8}개` : ''}`);
  }
  return reasons;
}

// ── 마이그레이션: 새로 생긴 migration.sql + 위험한 문장(추가 먼저·제거는 다음 배포 규칙, 런북 5번)
const DESTRUCTIVE = [
  [/\bDROP\s+TABLE\b/i, '표 삭제'],
  [/\bDROP\s+COLUMN\b/i, '컬럼 삭제'],
  [/\bRENAME\s+(COLUMN|TO)\b/i, '이름 변경(옛 서버·앱이 옛 이름을 씀)'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, '컬럼 타입 변경'],
  [/\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i, '빈 값 금지로 변경'],
  [/\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i, '기본값 없는 필수 컬럼 추가(옛 서버의 저장이 실패)'],
  [/\bDROP\s+TYPE\b|\bALTER\s+TYPE\b[^;]*\bRENAME\b/i, '종류(enum) 삭제·이름 변경'],
  [/\bTRUNCATE\b|\bDELETE\s+FROM\b/i, '데이터 삭제'],
  [/\bUPDATE\s+"/i, '데이터 일괄 수정'],
];

function migrations(base) {
  const added = base
    ? git('diff', '--name-only', '--diff-filter=A', base, target, '--', 'backend/prisma/migrations').split('\n').filter((file) => file.endsWith('migration.sql'))
    : [];
  return added.map((file) => {
    const sql = (tryGit('show', `${target}:${file}`) ?? '').replace(/--[^\n]*/g, '');
    const risks = DESTRUCTIVE.filter(([re]) => re.test(sql)).map(([, label]) => label);
    return { name: file.split('/').at(-2), file, risks };
  });
}

// ── 계산
const warnings = [];
const serverFiles = changed(bases.server)?.filter(serverFile);
const webFiles = changed(bases.web)?.filter(appFile);
const otaFiles = changed(bases.ota)?.filter((file) => appFile(file) && !webOnlyFile(file));
const migrationList = migrations(bases.server);
const destructive = migrationList.filter((m) => m.risks.length);
const schemaFiles = serverFiles?.filter((file) => file === 'backend/prisma/schema.prisma') ?? [];
if (schemaFiles.length && !migrationList.length) warnings.push('schema.prisma가 바뀌었는데 새 마이그레이션이 없음 — CI 드리프트 검사가 잡아야 함');

const nativeBase = bases.ota;
const native = nativeBase ? nativeReasons(nativeBase, target) : [];
// 버전업·네이티브 변경 전에 쌓인 JS 수정은 먼저 지금 버전 앱에 OTA(젤리 2026-08-26 사고) — 네이티브가 처음 바뀐 커밋의 바로 앞까지
let otaBeforeNative = null;
if (native.length && nativeBase) {
  const commits = git('rev-list', '--reverse', '--first-parent', `${nativeBase}..${target}`).split('\n').filter(Boolean);
  const firstNative = commits.find((sha) => nativeReasons(`${sha}^`, sha).length);
  const ref = firstNative ? git('rev-parse', `${firstNative}^`) : null;
  const pending = ref && ref !== nativeBase ? (changed(nativeBase, ref) ?? []).filter((file) => appFile(file) && !webOnlyFile(file)) : [];
  if (ref && pending.length) otaBeforeNative = { ref, files: pending.length };
}

const isRollback = (base) => !!base && base !== target && tryGit('merge-base', '--is-ancestor', target, base) !== null;
const decide = (base, files) => {
  if (!base) return { deploy: true, reason: '이전 배포 기록 없음 → 전부' };
  if (base === target) return { deploy: false, reason: '이미 이 커밋' };
  if (isRollback(base)) return { deploy: true, reason: `되돌리기(${short(base)} → ${short(target)})` };
  return files.length ? { deploy: true, reason: `바뀐 파일 ${files.length}개` } : { deploy: false, reason: '바뀐 것 없음' };
};

const server = decide(bases.server, serverFiles ?? []);
const web = decide(bases.web, webFiles ?? []);
let ota = decide(bases.ota, otaFiles ?? []);
// 마지막 OTA 커밋을 모르면 네이티브 변경 여부도 모름 — 잘못 보내면 깔린 앱이 꺼질 수 있어서 자동으로는 안 보냄
if (!bases.ota) ota = { deploy: false, reason: '마지막 OTA 커밋을 모름 — EXPO_TOKEN(워크플로가 EAS에서 읽음) 또는 --ota-base 필요' };
if (native.length) ota = { deploy: false, reason: '네이티브 변경이 있어 이 커밋은 OTA로 못 보냄(새 빌드 필요)' };

const logBase = tag || bases.server;
const commits = (logBase && logBase !== target ? git('log', '--format=%h %s', '--no-merges', `${logBase}..${target}`) : '')
  .split('\n')
  .filter(Boolean)
  .slice(0, 30);

const plan = {
  env: envName,
  target,
  bases,
  live,
  tag,
  server,
  migrations: migrationList,
  destructiveMigrations: destructive.length > 0,
  web,
  ota,
  otaBeforeNative,
  native: { required: native.length > 0, reasons: native },
  commits,
  warnings,
};

// ── 사람이 읽는 요약(워크플로 요약 화면·승인 전 확인·Claude 보고)
const yes = (part) => (part.deploy ? '✅ 올림' : '— 그대로');
const lines = [
  `### ${config.label} 배포 계획 — \`${short(target)}\``,
  '',
  '| 부분 | 결정 | 이유 | 지금 떠 있는 것 |',
  '|---|---|---|---|',
  `| 서버(API) | ${yes(server)} | ${server.reason} | ${short(bases.server)} |`,
  `| DB 구조(마이그레이션) | ${migrationList.length ? `✅ ${migrationList.length}개(서버 켤 때 적용)` : '— 없음'} | ${migrationList.map((m) => m.name).join(', ') || ''} | |`,
  `| 웹 | ${yes(web)} | ${web.reason} | ${short(bases.web)} |`,
  `| 앱 OTA(${config.otaChannel} 채널) | ${yes(ota)} | ${ota.reason} | ${short(bases.ota)} |`,
  `| 앱 새 빌드·스토어 | ${native.length ? '⚠️ 필요' : '— 필요 없음'} | ${native.join('; ')} | |`,
  '',
];
if (otaBeforeNative) lines.push(`- **버전업 전 OTA 먼저**: \`${short(otaBeforeNative.ref)}\`까지의 화면 수정(${otaBeforeNative.files}개 파일)을 지금 버전 앱에 OTA로 보낸 뒤 새 빌드`);
if (native.length) lines.push('- **새 빌드는 스토어 심사가 필요**(보통 1~2일). 프리뷰는 내부 배포라 심사 없음');
for (const m of destructive) lines.push(`- ⚠️ 위험한 마이그레이션 \`${m.name}\`: ${m.risks.join(', ')} — "추가 먼저, 제거는 다음 배포" 규칙 확인`);
for (const w of warnings) lines.push(`- ⚠️ ${w}`);
if (commits.length) lines.push('', '<details><summary>포함된 커밋</summary>', '', ...commits.map((c) => `- ${c}`), '', '</details>');
const markdown = lines.join('\n');

if (opts.json) writeFileSync(opts.json, `${JSON.stringify(plan, null, 2)}\n`);
summary(markdown);
output('server', server.deploy);
output('web', web.deploy);
output('ota', ota.deploy);
output('native', native.length > 0);
output('migrations', migrationList.length);
output('destructive', destructive.length > 0);
output('ota_before_native', otaBeforeNative?.ref ?? '');
output('target', target);
console.log(opts.quiet ? '' : markdown);
if (opts.print) console.log(readFileSync(opts.json, 'utf8'));
