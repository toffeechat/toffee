---
name: deploy
description: 토피 배포(프리뷰=데모 / 프로덕션=운영) — 사용자가 "올려", "반영해", "적용해", "배포", "데모에 넣어", "폰에서 보이게", "운영에 내보내", "실제 사용자에게", "고쳐서 내보내", "되돌려" 등 정해진 말이 아니어도 고친 것을 서버·DB·웹·앱(OTA·빌드)에 내보내려는 뜻이면 사용. 대상 판단 → 바뀐 파일로 무엇을 올릴지 판단 → 로컬 검사 → main 반영 → GitHub Actions 배포 워크플로 실행 → 자동 점검·Sentry 결과 보고까지.
---

# 토피 배포 스킬 (2026-10-25)

사용자는 2027년 2월부터 혼자 운영하며 출장 중에도 폰(Claude 앱)으로 지시한다. **정해진 말을 기다리지 말고 뜻으로 판단**하고,
끝나면 폰에서 읽기 좋게 짧게 보고한다. 규칙 원문은 `CLAUDE.md` "배포 규칙", 절차·되돌리기는 `docs/engineering/deploy-runbook.md`.

## 0. 환경

| | 프리뷰(데모) | 프로덕션(운영) |
|---|---|---|
| 서버·DB | Railway `toffee-demo` → `api-demo.toffeechat.app` (**main 자동 배포**) | Railway 운영 서비스 → `api.toffeechat.app` (자동 배포 끔, 워크플로가 커밋 지정) |
| 웹 | Cloudflare Pages `toffee-demo` → `demo.toffeechat.app` (**main 자동 빌드**) | Pages 직접 업로드 `toffee-app` → `app.toffeechat.app` |
| 앱 | OTA `preview` 채널, 빌드 `preview`(내부 배포, 심사 없음) | OTA `production` 채널, 빌드 `production`(스토어 심사) |
| 워크플로 | `deploy-preview.yml` | `deploy-production.yml`(승인자 = 사용자, 폰 GitHub 앱) |

프로덕션은 **아직 없다**(사업 본부 "운영 전환" 탭). 운영에 올려 달라고 하면 "운영 환경이 아직 없어서 프리뷰까지만 올렸고, 운영은
런북 '프로덕션 처음 돌리기' 체크리스트가 끝나면 가능"이라고 답한다. 존재 여부는 `curl -s https://api.toffeechat.app/health`로 확인.

## 1. 대상 판단 (규칙 1)

- 대상을 말하지 않은 "올려/적용/반영/배포/내보내" → **프리뷰**.
- "운영", "실제 사용자", "프로덕션", "스토어", "출시", "팬들한테" 등 실제 사용자를 뜻하는 게 분명할 때만 → **프로덕션**.
- 애매하면(예: "소속사가 쓰게" — 데모인지 계약 후 운영인지) **한 줄로만** 되묻는다: "프리뷰(데모)에 올릴까요, 운영에 올릴까요?"
- "되돌려/롤백" → 직전 배포가 있었던 환경. 아래 8번.

## 2. 무엇을 올릴지 — 바뀐 파일로 판단 (규칙 2)

```bash
git fetch origin main
node scripts/deploy/plan.mjs --env preview --target HEAD     # 떠 있는 서버·웹의 커밋과 비교, 표로 출력
```

`plan.mjs`가 판단하는 것(사람이 말하지 않아도):
- `backend/**` → 서버 배포. `backend/prisma/migrations/*` 새 폴더 → 마이그레이션(서버가 켜질 때 적용 — 서버 배포와 함께).
- `app/**`(e2e·스크립트·문서 제외) → 웹 + OTA. `app/public/**`만 → 웹만.
- 네이티브(`app.config.ts` 실제 변경, `plugins/`, `locales/`(iOS 권한 문구), 아이콘·스플래시, Firebase 설정 파일, iOS/안드로이드 코드가 있는
  패키지 추가·변경) → **OTA 불가, 새 빌드**. 이때 그 전에 쌓인 화면 수정은 **버전업 전에 OTA 먼저**(젤리 2026-08-26 사고) — 워크플로가 자동으로.
- 네이티브 변경이면 **먼저 사용자에게 한 줄로 알림**: 프리뷰 "새 빌드를 깔아야 보여요(심사 없음)", 프로덕션 "스토어 심사가 필요해 1~2일 걸려요".
- 순서: 서버(+마이그레이션) → 웹 → OTA. 백엔드와 같이 바뀐 수정은 서버 배포가 끝난 뒤 OTA(워크플로 순서가 그렇게 돼 있음).

## 3. 배포 전 확인

1. **시간**: `node scripts/deploy/check-window.mjs --env preview`(또는 production). **main에 합치는 순간 데모가 자동 배포되므로 합치기 전에** 확인.
   - 소속사 미팅 일정을 들으면(대화·사업 본부·소속사 페이지) `scripts/deploy/policy.json` `freezes`에 미팅 2시간 전 ~ 끝 시각을 추가(`env: "preview"`, 이유)하고
     같은 배포에 넣는다. 막혀 있으면 "미팅이 끝난 뒤 올릴게요" 또는 급한지 묻기.
   - 프로덕션은 태국 19:00~01:00 피함. 급한 장애 수정만 `override_window`.
2. **마이그레이션 규칙(규칙 5)**: 새 마이그레이션에 컬럼·표 삭제, 이름 변경, 타입 변경, 기본값 없는 필수 컬럼이 있으면 멈추고 고친다 —
   "추가 먼저(이번 배포), 안 쓰게 된 것 제거는 다음 배포". 옛 앱 버전이 새 서버와 계속 동작해야 함(응답 필드를 빼지 말고 새 필드는 선택값).
   강제 업데이트(`minVersion`, 운영자 화면 앱 설정)는 옛 버전이 정말 못 쓰게 될 때만 — 쓰기 전에 사용자에게 묻는다.
3. **로컬 검사**(CLAUDE.md "세션 환경" 그대로 — 바뀐 쪽만):
   - backend: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx nest build`
   - app: `npx tsc --noEmit`, `npx eslint src`, `npm test`(화면 흐름을 바꿨으면 서버·웹 띄우고 `npm run e2e`)
   - 스키마: 로컬 Postgres(`service postgresql start`)에 `npx prisma migrate deploy` → `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
   - 실패하면 고치고 다시. 실패한 채로 main에 넣지 않는다.
4. **문서 규칙**: STATUS·작업 로그 등 CLAUDE.md "문서 자동 업데이트"는 같은 커밋에.

## 4. main 반영 (프리뷰)

사용자가 배포를 요청한 것 = main 반영 허락(CLAUDE.md "main 반영은 사용자가 요청할 때만"의 그 요청). 작업 브랜치에 커밋·push한 뒤:
1. `mcp__github__list_pull_requests`로 같은 브랜치의 열린 PR이 있으면 그것, 없으면 `mcp__github__create_pull_request`(base `main`).
2. CI(`ci.yml`, PR에서 돎)가 끝나기를 기다림 — `mcp__github__pull_request_read`(get_status / get_check_runs). 진행 중이면 `subscribe_pr_activity`로
   구독하고 턴을 끝낸 뒤 이벤트로 이어감(sleep 폴링 금지). 빨간색이면 원인을 고쳐 다시 push.
3. 초록이면 `mcp__github__merge_pull_request`(merge_method `merge` — 이 저장소 관례). 합치면 Railway·Pages가 바로 배포를 시작.

## 5. 워크플로 실행

**⚠️ 서버가 새 커밋으로 올라간 뒤에 실행**(2026-10-28 사고): Railway `toffee` 서비스는 "Wait for CI"가 켜져 있어 그 커밋의 **모든** GitHub
작업이 끝나기를 기다린다. 합치자마자 `deploy-preview`를 돌리면 워크플로(서버를 기다림)와 Railway(워크플로를 기다림)가 서로 기다리다
워크플로가 시간 초과로 **실패** → Railway는 "검사 실패" 커밋이라며 배포를 **건너뜀**(서버는 옛 커밋 그대로, 웹만 새 커밋).
그래서 서버가 바뀌는 커밋(`backend/**`)이면 먼저
`node scripts/deploy/wait-deployed.mjs --env preview --part server --target <머지 커밋>`(백그라운드)으로 서버 교체를 확인한 뒤 실행한다.
이미 꼬였으면: 새 커밋이 있어야 Railway가 다시 배포함(watchPatterns `/backend/**`라 `backend/` 안 파일이 바뀌어야) — 사용자에게 Railway
`toffee-demo` → 서비스 → Deployments에서 최신 커밋 배포를 부탁하거나, `backend/` 안의 실제 수정이 담긴 PR을 합침(빈 커밋 금지).

```
mcp__github__actions_run_trigger  method=run_workflow  owner=toffeechat repo=toffee
  workflow_id=deploy-preview.yml  ref=main  inputs={"ref":"main","ota_message":"<한 줄 설명>"}
```
- 네이티브 변경이면 `build`를 `ios`(또는 all)로. 배포를 피할 시간인데 급하면 `override_window: true`(사용자가 급하다고 했을 때만).
- 진행 확인: `mcp__github__actions_list`(list_workflow_runs, workflow_id `deploy-preview.yml`) → `actions_get`(get_workflow_run / list_workflow_jobs).
  기다릴 땐 sleep 대신 `node scripts/deploy/wait-deployed.mjs --env preview --part server --target <sha>`를 백그라운드(run_in_background)로 돌려
  끝나면 깨어나게 하거나, Monitor로 실행 상태를 본다. 보통 10~20분(CI 대기 + 도커 빌드).
- 실패하면 `mcp__github__get_job_logs`(failed_only)로 원인을 보고, 이 PR 때문이면 고쳐서 다시 4번부터.

## 6. 보고 (규칙 6)

폰에서 읽기 좋게 5줄 안팎:
- 무엇을 올렸는지(서버·DB·웹·OTA·빌드 중 실제로 한 것) + 커밋
- 자동 점검 결과(헬스·로그인·메시지 보내기·받기·답장·웹) — 로그의 "자동 점검" 표
- Sentry 새 오류(워크플로 "Sentry 새 오류" 단계 — 토큰 없으면 "Sentry 확인 안 됨"이라고 그대로)
- 사용자가 할 일이 있으면(앱 완전히 껐다 켜기, 새 빌드 설치 링크, 데모 초기화 등)
- 실패면 원인 + **되돌리기 제안**(8번) — 실행은 사용자가 "그래" 하면

## 7. 프로덕션

1. 그 커밋이 프리뷰를 통과했는지(커밋 상태 `deploy/preview` = success, `mcp__github__get_commit` 또는 워크플로가 검사). 안 거쳤으면
   **먼저 프리뷰**(규칙 3). 급한 수정도 프리뷰를 거치되 확인을 짧게 — 사용자 화면 확인을 기다리지 않고 자동 점검 통과만으로 넘어감.
2. `node scripts/deploy/plan.mjs --env production --target <sha>`로 **"무엇이 올라가는지" 요약을 먼저 보여 줌**(서버·마이그레이션·웹·OTA·스토어 빌드,
   위험한 마이그레이션, 피할 시간). 스토어 빌드가 필요하면 심사 안내.
3. `actions_run_trigger` `deploy-production.yml` `inputs={"sha":"<sha>", "ota_message":"…", "build":"none"}` → 사용자에게
   "GitHub 앱 → Actions → Deploy production → Review deployments → Approve" 안내 + 실행 링크.
4. 승인 뒤 6번처럼 보고. 운영 배포 기록은 워크플로가 `deployed/production` 태그·`deploy/production` 상태로 남김.

## 8. 되돌리기

- 프리뷰: 서버·웹은 main 자동 배포라 **문제 커밋을 main에서 revert하는 PR** → 머지 → `deploy-preview.yml` 다시. 급하면 Railway·Pages 화면의
  직전 배포 Redeploy/Rollback을 사용자에게 안내. OTA는 `eas update:republish`(런북 8번).
- 프로덕션: `deploy-production.yml` `inputs={"sha":"<직전 deployed/production>","rollback":true}`. DB 마이그레이션은 되돌리지 않음
  (추가만 했다면 옛 서버도 동작 — 그래서 규칙 5).

## 9. 하지 말 것

- **운영 DB에 임의 SQL 금지**(규칙 4) — psql·Prisma 스크립트로 운영 데이터를 직접 바꾸지 않는다. 회원·결제·아티스트 처리는 운영자 화면 기능으로.
  화면에 없는 일회성 수정이 꼭 필요하면 `ops/data-fixes/YYYYMMDD-설명.sql` 커밋 → `db-data-fix-production.yml`(백업 → 미리보기 → 승인 2번).
  같은 일이 또 생기면 운영자 화면 기능으로 만들자고 제안(STATUS 아이디어 보관함).
- 비밀값(토큰·DB 주소·입장 코드)을 저장소·대화·PR에 적지 않음 — GitHub Secrets·Railway·EAS에만.
- `eas update`를 직접 돌리지 않음(env가 빠짐) — 항상 `app/scripts/ota.mjs`(워크플로가 씀).
- 프로덕션 워크플로의 승인을 우회하거나, 프리뷰를 안 거친 커밋을 운영에 올리지 않음.
