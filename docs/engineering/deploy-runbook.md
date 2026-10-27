# 배포 런북 — 프리뷰(데모)·프로덕션(운영)

2026-10-25 작성. 2027년 2월부터 1인 운영 — 출장 중에도 폰(Claude 앱)에서 말하면 Claude가 이 절차대로 서버·DB 구조·웹·앱(OTA)을 배포한다.
규칙 원문은 `CLAUDE.md` "배포 규칙", Claude의 순서는 `.claude/skills/deploy/SKILL.md`, 비개발자 요약은 `docs/product/deploy-guide.md`.

## 1. 한눈에

```
[작업 브랜치] --로컬 검사--> PR → CI(ci.yml) 초록 → main 머지
        │                                   │ (자동) Railway toffee-demo 도커 빌드·배포 — 켤 때 prisma migrate deploy
        │                                   │ (자동) Cloudflare Pages toffee-demo 웹 빌드
        ▼
deploy-preview.yml (수동 실행: Claude가 MCP로 / 폰 GitHub 앱)
  배포 피할 시간? → plan(바뀐 부분) → 서버·웹이 그 커밋인지 기다림 → (버전업 전 OTA) → OTA preview → (요청 시 내부 빌드)
  → 자동 점검 → Sentry → 커밋에 deploy/preview 상태 + deployed/preview 태그
        ▼
deploy-production.yml (수동 실행, sha = 프리뷰 통과 커밋)
  plan 작업(승인 전): 프리뷰 통과 확인 → 피할 시간 → 바뀐 부분 요약 → 위험한 마이그레이션이면 멈춤
  deploy 작업(환경 production 승인 = 사용자): 백업(마이그레이션 있을 때) → Railway 이 커밋 배포 → 웹 빌드·Pages 업로드
  → 버전업 전 OTA → OTA production → (요청 시 스토어 빌드·제출) → 자동 점검 → Sentry → deploy/production 상태 + deployed/production 태그
```

## 2. 파일

| 파일 | 하는 일 |
|---|---|
| `.github/workflows/deploy-preview.yml` | 프리뷰 확인·OTA·점검·통과 표시 |
| `.github/workflows/deploy-production.yml` | 운영 배포(plan → 승인 → deploy) |
| `.github/workflows/db-data-fix-production.yml` | 운영 DB 데이터 수정(백업 → 미리보기 → 승인 2번) — 9번 |
| `.github/actions/db-backup/action.yml` | pg_dump → gpg 공개키 암호화 → R2 백업 버킷 |
| `scripts/deploy/plan.mjs` | 떠 있는 커밋과 비교해 서버·마이그레이션·웹·OTA·네이티브 판단(Claude도 로컬에서 같은 것 실행) |
| `scripts/deploy/check-window.mjs` + `policy.json` | 배포를 피할 시간(6번) |
| `scripts/deploy/wait-deployed.mjs` | 서버 `/health`·웹 `/version.json`의 `commit`이 그 커밋(또는 포함하는 새 커밋)이 될 때까지 |
| `scripts/deploy/smoke.mjs` | 자동 점검(10번) |
| `scripts/deploy/sentry-check.mjs` | 최근 30분 새 이슈(서버 `toffee-backend`·앱 `toffee-app`, 환경별) |
| `scripts/deploy/railway-deploy.mjs` | Railway GraphQL `serviceInstanceDeployV2(commitSha)` — 운영용, 되돌리기도 같은 명령 |
| `scripts/deploy/eas-last-update.mjs` | 채널의 마지막 OTA `gitCommitHash`(OTA 기준) |
| `backend/src/smoke/` | 점검 전용 계정·숨긴 대화방 + `POST /smoke/session` |
| `app/scripts/write-version.mjs` | 웹 빌드에 `dist/version.json`(커밋) — `npm run build:web`이 자동으로 |

배포 기록: 서버 `GET /health` → `{status, commit}`(Railway가 주는 `RAILWAY_GIT_COMMIT_SHA`, 다른 곳은 `GIT_COMMIT_SHA`), 웹 `/version.json`,
OTA는 EAS 업데이트 기록, git 태그 `deployed/preview`·`deployed/production`(성공할 때마다 옮김), 커밋 상태 `deploy/preview`·`deploy/production`.

## 3. 무엇을 올릴지 — plan.mjs 기준

| 바뀐 곳 | 결정 |
|---|---|
| `backend/**`(md 제외) | 서버 배포 |
| `backend/prisma/migrations/<새 폴더>/migration.sql` | 마이그레이션 — 서버가 켜질 때 `docker-entrypoint.sh`가 적용(서버 배포와 함께). 위험 문장 검사(5번) |
| `app/**`(e2e·scripts·테스트·문서 제외) | 웹 + OTA |
| `app/public/**`만 | 웹만 |
| 네이티브: `app.config.ts`(주석만 바뀐 건 제외), `app/plugins/`, `app/locales/`(iOS 권한 문구), 아이콘·스플래시 이미지, Firebase 설정 파일, iOS·안드로이드 코드가 든 패키지(설치된 `node_modules`에 `ios`/`android`/`expo-module.config.json`이 있으면, 없으면 이름으로 짐작) | OTA 불가 → 새 빌드. 네이티브가 처음 바뀐 커밋 바로 앞까지의 화면 수정은 **버전업 전 OTA**로 먼저(`ota_before_native`) |

기준(이전 배포본): 서버 = 떠 있는 서버의 `/health` commit, 웹 = `/version.json`, 둘 다 모르면 `deployed/<env>` 태그, 그것도 없으면 "처음 → 전부".
OTA 기준은 EAS의 마지막 OTA 커밋만 믿음(모르면 자동 OTA 안 함 — 잘못 보내면 깔린 앱이 꺼질 수 있어서). 로컬 확인:

```bash
node scripts/deploy/plan.mjs --env preview --target HEAD
node scripts/deploy/plan.mjs --env preview --server-base <커밋> --ota-base <커밋>   # 기준을 직접 줘서 시험
```

## 4. 프리뷰 배포

- 서버·웹은 Railway(`backend/railway.json` watchPatterns `/backend/**`)·Cloudflare Pages(루트 `app`, `npm run build:web`, watch `*`)가 **main push마다 자동**.
  그래서 **main에 합치는 것 = 데모 배포 시작** — 피할 시간 확인은 합치기 전에(Claude 스킬 3번). 워크플로는 "정말 올라갔는지"를 커밋으로 확인.
- 입력: `ref`(기본 main), `ota_message`, `build`(none·ios·android·all — 내부 배포 빌드, `--no-wait`), `skip_ota`, `override_window`.
- `EXPO_TOKEN`이 없으면 OTA·빌드를 건너뛰고 요약에 "PC에서 `npm run ota -- preview`"를 남김. `PREVIEW_SMOKE_TEST_SECRET`이 없으면 로그인·메시지 점검은 ⚠️ 건너뜀(헬스·웹만).
- 걸리는 시간: CI 대기(Railway "Wait for CI"를 켰다면) + 도커 빌드 3~5분, Pages 빌드 3~5분, OTA 2~3분, 점검 10초.

## 5. 마이그레이션 규칙 — 추가 먼저, 제거는 다음 배포

새 서버가 뜨는 동안 옛 서버가 잠깐 같이 돌고(Railway 무중단 교체), 되돌리면 옛 서버가 새 DB 구조로 돌고, 팬 폰엔 옛 앱 버전이 몇 주씩 남는다.
그래서 한 배포에서 **옛 코드가 깨지는 변경**을 하지 않는다.

| 하고 싶은 것 | 1번째 배포 | 2번째 배포(옛 코드가 다 사라진 뒤) |
|---|---|---|
| 컬럼 추가 | 빈 값 허용 또는 기본값(`@default`)으로 추가 | (필요하면) 값 채운 뒤 필수로 |
| 컬럼 이름 바꾸기 | 새 컬럼 추가 + 둘 다 쓰기 + 옛 값 복사(마이그레이션 SQL `UPDATE`) | 옛 컬럼 삭제 |
| 컬럼·표 삭제 | 코드에서 안 쓰게 | 삭제(`allow_destructive_migration` 켜고) |
| 타입 바꾸기 | 새 컬럼 추가 | 옛 컬럼 삭제 |
| enum 값 빼기 | 코드에서 안 쓰게 + 데이터 옮기기 | 값 삭제 |
| API 응답 필드 | 빼지 않음(옛 앱이 읽음). 새 필드는 추가만 | 옛 앱이 최소 지원 버전 아래로 다 내려간 뒤 정리 |
| API 요청 필드 | 새 필드는 선택값(옛 앱은 안 보냄) | — |

- `plan.mjs`가 새 migration.sql에서 표·컬럼 삭제, 이름·타입 변경, 빈 값 금지 변경, 기본값 없는 필수 컬럼 추가, enum 삭제·이름 변경, `TRUNCATE`·`DELETE`·`UPDATE`를
  찾아 경고. **운영 워크플로는 멈춤** — 2번째 배포인 게 확실할 때만 `allow_destructive_migration: true`.
- 마이그레이션이 있는 운영 배포는 시작 전에 DB 백업(`db-backup` 액션). 마이그레이션 자체는 되돌리지 않는다(되돌리기 = 앞으로 고치는 새 마이그레이션).
- **강제 업데이트(`minVersion`)**: 운영자 화면 앱 설정의 최소 버전. 옛 앱이 새 서버로 **정말 동작할 수 없을 때만**(보안·결제 오류 등). 올리면 그 아래 버전은
  앱을 못 쓰고 스토어로 보내지므로 사용자 확인 후, 그리고 새 버전이 스토어 심사를 통과해 **공개된 뒤에**.

## 6. 배포를 피할 시간

`scripts/deploy/policy.json`(시간대 Asia/Bangkok):
- 프리뷰 03:45~04:20 — 데모 매일 자동 초기화(04:00) 중 서버가 바뀌면 초기화가 실패할 수 있음.
- 프로덕션 19:00~01:00 — 태국 팬 사용이 가장 많은 시간. 03:45~04:30 — 새벽 정리 작업(보관 기간·업로드·접속 기록).
- `freezes`: 소속사 미팅 2시간 전 ~ 끝(프리뷰). Claude가 일정을 들으면 추가하고, 지난 항목은 지운다.
  ```json
  { "env": "preview", "from": "2026-11-03T13:00:00+09:00", "to": "2026-11-03T16:00:00+09:00", "reason": "OO 소속사 화상 미팅" }
  ```
- 급한 장애 수정은 `override_window: true`(요약에 경고가 남음).

## 7. OTA·앱 빌드

- OTA는 항상 `app/scripts/ota.mjs`(eas.json 프로필 env + EAS 서버 변수를 넣고 채널로) — 자세한 건 `device-build.md` 7번. 받는 쪽은 앱을 완전히 껐다 켜면 적용.
- 같은 앱 버전(`runtimeVersion: appVersion`)끼리만 받는다. 네이티브를 바꾸면 `app.config.ts` `version`을 올려 빌드 — **올리기 전에** 쌓인 JS 수정을 OTA로(워크플로가 자동).
- 프리뷰 빌드는 내부 배포(심사 없음, 등록한 기기만). 프로덕션 `build`는 `eas build --profile production --auto-submit`(App Store Connect API 키·구글 서비스 계정이
  EAS에 있어야 함) → 심사 → 공개는 사용자가 스토어에서(수동 출시). 스토어 소개글 언어별 작성은 `store-submission.md`.

## 8. 되돌리기

| | 프리뷰 | 프로덕션 |
|---|---|---|
| 서버 | 문제 커밋을 main에서 revert(PR) → 자동 배포 → `deploy-preview` 다시. 급하면 Railway `toffee-demo` → Deployments → 직전 배포 Redeploy | `deploy-production`을 `sha=<직전 deployed/production>`, `rollback=true`로(직전 운영 배포본만 허용) |
| 웹 | revert와 같이. 급하면 Pages → Deployments → 직전 배포 "Rollback to this deployment" | 위와 같이(웹도 그 커밋으로 다시 빌드) |
| OTA | `cd app && npx eas-cli update:list --branch preview` → 직전 그룹 `npx eas-cli update:republish --group <id>` (또는 `update:roll-back-to-embedded --channel preview`) | 같은 명령, `production` |
| DB | 되돌리지 않음 — 추가만 했으므로 옛 서버도 동작(5번). 데이터가 망가졌으면 백업 버킷에서 복구(아래) | 같음 |

DB 복구(최후 수단): 백업 버킷 `prod/<시각>-deploy-<커밋>.dump.gpg` 받기 → 사용자 PC에서 비밀키로 `gpg -d` → **새 Postgres**에 `pg_restore` → 확인 후 Railway `DATABASE_URL` 교체.
운영 DB에 바로 덮어쓰지 않는다.

## 9. 운영 DB 데이터 수정

원칙: 운영 DB에 임의 SQL 금지 — 운영자 화면 기능(회원 정지·역할·환불·활동 종료·공지·금칙어 등)으로. 꼭 필요하면 `ops/data-fixes/README.md` 절차:
SQL을 `ops/data-fixes/YYYYMMDD-설명.sql`로 main에 커밋 → **Production data fix** 실행(`sql_file`, `expected_rows`, `reason`) →
승인 1(`production`): 백업 + `BEGIN; …; ROLLBACK;`으로 미리보기, 바뀌는 줄 수가 `expected_rows`와 같아야 통과 →
승인 2(`production-data`): 다시 세어 같으면 `BEGIN; …; COMMIT;`. `BEGIN`·`COMMIT`·`ALTER`·`DROP`·`CREATE` 등은 파일에 못 넣음(구조는 마이그레이션).

## 10. 자동 점검(스모크 테스트)

`node scripts/deploy/smoke.mjs --env preview|production` — 서버 `/health`(커밋) → `/health/ready`(DB) → `POST /smoke/session`(헤더 `x-smoke-secret`) →
`/auth/me` → 점검 아티스트가 숨긴 대화방에 메시지(`silent` — 푸시 없음) → 점검 팬이 목록에서 받기 → 팬 답장 → 둘 다 회수 → 웹 첫 화면·`/version.json`.

- **점검 계정**(`backend/src/smoke`, 고정 ID `00000000-0000-4000-9000-…1~3`): 아티스트 `smoke-artist@system.toffeechat.app`(ACTOR), 팬 `smoke-fan@…`(USER),
  대화방 "Smoke Test (system)" — **활동 종료 상태**라 둘러보기·검색·새 구독에 안 보이고, 소속사가 없어 소속사 화면·정산에 안 잡히고, 구매 기록 없는 구독이라
  매출에도 안 잡힘. 번역·알림 꺼짐. 운영자 화면 아티스트·회원 목록엔 보임(이름에 Smoke Test). 매 점검 때 정지·역할 등을 원래대로 되돌리고, 하루 지난 점검 메시지는 지움.
- `SMOKE_TEST_SECRET`이 서버에 없으면 `/smoke/session`은 404, 틀리면 401(분당 5회). 운영에선 32자 이상이어야 서버가 켜짐. 토큰은 10분짜리.
- 데모 초기화가 점검 계정을 지워도 다음 점검 때 다시 만들어짐.
- 로컬: 서버를 `SMOKE_TEST_SECRET=…`로 켜고 `DEPLOY_API_URL=http://localhost:3000 DEPLOY_WEB_URL=… SMOKE_TEST_SECRET=… node scripts/deploy/smoke.mjs`.

## 11. 비밀값·변수 (값은 저장소에 적지 않음)

**GitHub → Settings → Secrets and variables → Actions**(저장소 전체):

| 이름 | 종류 | 쓰는 곳 |
|---|---|---|
| `EXPO_TOKEN` | Secret | OTA·빌드·마지막 OTA 읽기(Expo → Access tokens, 조직 `toffeechat-team` 권한) |
| `PREVIEW_SMOKE_TEST_SECRET` | Secret | 프리뷰 점검 — Railway `toffee-demo` 변수 `SMOKE_TEST_SECRET`과 같은 값 |
| `SENTRY_AUTH_TOKEN` | Secret | Sentry 새 오류 확인(읽기: `project:read`, `event:read`) — 앱 소스맵용 EAS 변수와 같은 토큰을 써도 됨 |

**Environment `production`**(Required reviewers = 사용자, Deployment branches = main만):

| 이름 | 종류 | |
|---|---|---|
| `RAILWAY_TOKEN` | Secret | 운영 프로젝트의 **Project token**(운영 환경 전용) |
| `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID` | Variable | 운영 서비스·환경 ID(Railway 서비스 설정 화면 / `Cmd+K` → Copy ID) |
| `RAILWAY_TOKEN_KIND` | Variable | 계정 토큰을 쓸 때만 `account` |
| `CLOUDFLARE_API_TOKEN` | Secret | 템플릿 "Edit Cloudflare Pages"(이 계정만) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` | Variable | 계정 ID, `toffee-app` |
| `PROD_SMOKE_TEST_SECRET` | Secret | 운영 서버 `SMOKE_TEST_SECRET`과 같은 값(32자+, 데모와 다르게) |
| `PROD_DATABASE_URL` | Secret | 백업·데이터 수정용 운영 DB 주소(Railway Postgres 공개 주소 — 백업 전용 읽기 계정이면 더 좋음, 데이터 수정은 쓰기 필요) |
| `BACKUP_GPG_PUBLIC_KEY` | Secret | 백업 암호화 공개키(비밀키는 사용자 PC·비밀번호 관리자에만) |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | Secret | R2 백업 버킷(예: `toffee-backups`)·이 버킷만 쓰기 토큰 |
| `PROD_API_URL`, `PROD_WEB_URL` | Variable | 비우면 `https://api.toffeechat.app`·`https://app.toffeechat.app` |
| `EXPO_PUBLIC_WEB_KAKAO_REST_API_KEY`, `EXPO_PUBLIC_WEB_NAVER_CLIENT_ID`, `EXPO_PUBLIC_WEB_LINE_CHANNEL_ID`, `EXPO_PUBLIC_WEB_APPLE_SERVICES_ID`, `EXPO_PUBLIC_IOS_APP_STORE_ID` | Variable | 운영 웹 빌드의 공개 키(나머지 `EXPO_PUBLIC_*`는 `eas.json` production에서) |

**Environment `production-data`**: Required reviewers = 사용자, Secret `PROD_DATABASE_URL`(데이터 수정 2단계용 — production과 같은 값).
**Environment `preview`**: 워크플로가 처음 돌 때 자동으로 생김(승인 없음).

## 12. 프로덕션 처음 돌리기 — 체크리스트

운영 환경(사업 본부 "운영 전환" 2단계)이 생긴 뒤 한 번:

1. [ ] Railway 운영 프로젝트·서비스: GitHub 저장소 연결하되 **자동 배포 끄기**(Settings → Source에서 브랜치 트리거 해제 — 워크플로가 커밋을 지정),
       Root Directory `/backend`, Config `/backend/railway.json`, `SMOKE_TEST_SECRET`(32자+), `SENTRY_ENVIRONMENT=production`. Postgres 백업 켜기.
       워크스페이스 Usage Limits는 **하드 리밋 없이(또는 넉넉하게) 알림만**(데모의 $15 하드 리밋을 그대로 쓰면 운영 서버가 꺼짐).
2. [ ] Cloudflare Pages `toffee-app`을 **Direct Upload**로 생성(Git 연결 X — 워크플로가 올림), 커스텀 도메인 `app.toffeechat.app`.
3. [ ] R2 백업 버킷 + 토큰, gpg 키 쌍 만들기(`gpg --quick-gen-key "Toffee Backup" rsa4096 encr never` → `gpg --armor --export` 공개키만 GitHub에).
4. [ ] GitHub Environments `production`·`production-data` 만들고 승인자 = 본인, 11번 표의 값 넣기. 폰 GitHub 앱 알림 켜기(Settings → Notifications → Actions).
5. [ ] 첫 실행: 프리뷰를 통과한 커밋으로 `Deploy production` — `sha` 직접 입력(처음엔 `deployed/production` 태그가 없음). 확인할 것:
   - plan 요약이 "이전 배포 기록 없음 → 전부"로 나오는지, 승인 버튼이 폰에 오는지
   - `railway-deploy.mjs`가 배포를 거는지(Railway API가 바뀌어 실패하면 오류 메시지대로 `serviceInstanceDeployV2` 인자 확인), 서버 `/health`에 커밋이 나오는지
   - 웹 빌드가 운영 API 주소로 됐는지(`app.toffeechat.app` 로그인 화면에 입장 코드 로그인이 **안** 보여야 함), `/version.json`
   - OTA: 운영 첫 OTA는 기준이 없으니 자동으론 안 보냄 → 스토어 빌드 커밋을 `ota_base`로 넣어 다음 실행부터
   - 자동 점검 전부 ✅, Sentry 확인 줄이 나오는지, `deployed/production` 태그
6. [ ] 일부러 되돌리기 한 번: 직전 커밋으로 `rollback=true` 실행 → 서버 커밋이 바뀌는지.
7. [ ] 마이그레이션이 든 배포로 백업 단계가 도는지(버킷에 `.dump.gpg`), 복구 훈련 1회(8번 "DB 복구" — 새 Postgres에).
8. [ ] `Production data fix`를 무해한 SQL(예: 점검 팬 `statusMessage` 바꾸기, 1줄)로 한 번 — 미리보기·두 번째 승인 흐름 확인.
9. [ ] 업타임 모니터(`/health/ready`)·Sentry 폰 알림이 오는지(ops-infra-backlog "배포 자동화").

## 13. 문제가 생기면

- 폰 분실·Claude/GitHub 장애 때 폰만으로 하는 비상 조치(Railway Redeploy·Pages Rollback·점검 모드)는 `docs/product/phone-loss-plan.md` 4번.

- "서버가 제한 시간 안에 안 바뀜" → Railway 빌드 로그. "Wait for CI"를 켰다면 CI가 빨간지. 웹이면 Pages 빌드 로그(Build watch paths가 `*`인지 — 2026-10-02 교훈).
- `/health`에 `commit: null` → Railway가 GitHub 배포가 아닌 방식(CLI `railway up`)으로 올렸음 → 서버 변수 `GIT_COMMIT_SHA`를 넣거나 GitHub 배포로.
- 점검 "로그인" 404 → 서버에 `SMOKE_TEST_SECRET` 없음, 401 → GitHub Secret과 값이 다름.
- 점검 "메시지 보내기" `GREETINGS_REQUIRED` 등 → 점검 대화방을 누가 고쳤음 — 다음 점검이 되돌림. 반복되면 `backend/src/smoke/smoke.service.ts` 확인.
- OTA "마지막 OTA 커밋을 모름" → `EXPO_TOKEN` 확인, 또는 `ota_base` 입력(마지막 스토어/내부 빌드 커밋).
