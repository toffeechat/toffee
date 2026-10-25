#!/usr/bin/env node
// Railway에 "정확히 이 커밋"을 배포(2026-10-25, 프로덕션용 — 운영 서비스는 main 자동 배포를 꺼 둠). GitHub 연결 서비스의 해당 커밋을
// 빌드·배포하고(backend/railway.json 설정 그대로, 켤 때 마이그레이션), 확인은 wait-deployed.mjs가 /health의 commit으로.
// 되돌리기도 같은 명령에 예전 커밋을 넣으면 됨.
//   RAILWAY_TOKEN=… RAILWAY_SERVICE_ID=… RAILWAY_ENVIRONMENT_ID=… node scripts/deploy/railway-deploy.mjs --commit <sha>
// 토큰: 프로젝트 토큰(Project → Settings → Tokens, 그 환경 전용 — 권장) 또는 계정 토큰(RAILWAY_TOKEN_KIND=account)
import { args, fetchJson, short } from './lib.mjs';

const opts = args();
const commit = opts.commit;
const token = process.env.RAILWAY_TOKEN?.trim();
const serviceId = process.env.RAILWAY_SERVICE_ID?.trim();
const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
const missing = [['RAILWAY_TOKEN', token], ['RAILWAY_SERVICE_ID', serviceId], ['RAILWAY_ENVIRONMENT_ID', environmentId], ['--commit', commit]]
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length) {
  console.error(`⛔ Railway 배포에 필요한 값이 없음: ${missing.join(', ')} (docs/engineering/deploy-runbook.md "처음 한 번")`);
  process.exit(1);
}

const headers =
  process.env.RAILWAY_TOKEN_KIND === 'account' ? { authorization: `Bearer ${token}` } : { 'project-access-token': token };
const res = await fetchJson('https://backboard.railway.com/graphql/v2', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({
    query: 'mutation Deploy($serviceId: String!, $environmentId: String!, $commitSha: String) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha) }',
    variables: { serviceId, environmentId, commitSha: commit },
  }),
  timeoutMs: 30_000,
});
if (!res.ok || res.body?.errors?.length) {
  console.error(`⛔ Railway 배포 요청 실패(HTTP ${res.status}): ${JSON.stringify(res.body?.errors ?? res.text).slice(0, 400)}`);
  process.exit(1);
}
console.log(`Railway 배포 요청 완료 — 커밋 ${short(commit)}, deployment ${res.body?.data?.serviceInstanceDeployV2 ?? '?'}`);
