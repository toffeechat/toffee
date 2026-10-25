#!/usr/bin/env node
// 서버·웹이 이 커밋(또는 이걸 포함한 더 새 커밋)으로 바뀔 때까지 기다림(2026-10-25). 프리뷰는 Railway·Cloudflare Pages가 main을 자동
// 배포하니 여기선 "정말 올라갔는지"만 확인, 프로덕션은 railway-deploy.mjs로 배포를 건 뒤 같은 방식으로 확인.
//   node scripts/deploy/wait-deployed.mjs --env preview --target <sha> --part server|web [--timeout-min 20] [--exact]
// --exact: 정확히 그 커밋만(운영 — 커밋을 지정해 배포하고, 되돌리기 땐 떠 있는 새 커밋이 옛 커밋을 "포함"해서 바로 통과해 버리면 안 되므로)
import { args, commitExists, contains, envConfig, liveCommits, short, tryGit } from './lib.mjs';

const opts = args();
const config = envConfig(opts.env || 'preview');
const target = opts.target;
const part = opts.part || 'server';
const deadline = Date.now() + Number(opts['timeout-min'] || 20) * 60_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let last = null;
while (Date.now() < deadline) {
  const live = (await liveCommits(config))[part];
  if (live !== last) {
    console.log(`${part}: 지금 ${short(live)} (기다리는 커밋 ${short(target)})`);
    last = live;
  }
  // 그사이 main에 더 새 커밋이 들어와 그게 배포됐으면 그 커밋을 받아 와서 포함 관계를 봄
  if (live && !commitExists(live)) tryGit('fetch', '--quiet', 'origin', live);
  if (live && (live.startsWith(target) || (!opts.exact && contains(live, target)))) {
    console.log(`✅ ${part} 배포 확인: ${short(live)}`);
    process.exit(0);
  }
  await sleep(15_000);
}
console.error(`⛔ ${part}가 제한 시간 안에 ${short(target)}로 안 바뀜(지금 ${short(last)}) — Railway/Cloudflare 빌드 로그 확인`);
process.exit(1);
