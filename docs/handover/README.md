# 계정 이전 인수인계 (2026-10-08)

지금까지 토피·젤리 작업을 해 온 Claude 계정을 더 이상 쓰지 않기로 해서, **다른 Claude 계정에서 이어서 해도 끊기지 않게**
정리한 문서다. 새 계정의 첫 세션은 이 문서부터 읽는다. 젤리 쪽은 젤리 저장소(`ddururiiiiiii/gelly`)의
`docs/handover/README.md`에 같은 형식으로 따로 있다.

---

## 1. 무엇이 계정에 묶여 있고, 무엇이 안전한가

| 구분 | 어디 있나 | 새 계정에서 |
|---|---|---|
| 코드·문서(`STATUS.md`, 작업 로그, 기획 문서, `CLAUDE.md`) | GitHub `toffeechat/toffee` | **그대로 이어짐**. `CLAUDE.md`가 사실상 Claude의 "메모리"라 규칙·관례도 같이 넘어감 |
| GitHub 연결 | Claude GitHub App이 `toffeechat` 조직(All repositories)에 설치돼 있음 | 새 Claude 계정에서 **같은 GitHub 개인 계정으로 연결**만 하면 됨(App 설치는 GitHub 쪽이라 유지) |
| 아티팩트(사업화 장부·사업화 일정·실기기 테스트 체크리스트 등) | 옛 Claude 계정 소유 | **안 넘어감** → 이 폴더 `artifacts/`에 페이지를 백업해 둠. 새 계정에서 다시 게시(3번) |
| 아티팩트에 저장된 데이터(장부의 계정·비용, 일정 체크 상태) | 옛 계정의 아티팩트 DB | 일정 체크 상태는 `artifacts/data/`에 백업. **장부(계정·비용)는 개인정보가 있어 저장소에 넣지 않음** → 별도 파일(아래 "개인 백업 파일")로 받아 보관 |
| 세션 대화 기록 | 옛 계정 | **안 넘어감**. 필요한 결론은 작업 로그(`docs/deployment-readiness-plan.md`)와 이 문서에 이미 옮겨 둠 |
| 클라우드 환경 설정(네트워크 권한 등) | 옛 계정(환경 이름 "Default", 네트워크 **Trusted**, 따로 넣은 비밀값·설치 스크립트 없음) | 새 계정에서 환경을 새로 만들 때 네트워크를 **Trusted**로(npm·Prisma 설치에 필요) |
| 예약 작업(Routine) | 없음 | 할 일 없음 |
| 외부 서비스 계정(Cloudflare·Railway·Expo·Firebase·Sentry·Anthropic Console·소셜 로그인 등) | 토피 Gmail·`dev@` 등 **Claude 계정과 무관** | 영향 없음. Anthropic Console(번역 API, `dev@toffeechat.app`)도 Claude 채팅 계정과 별개 |

> 참고: 사업화 장부 기록상 Claude Pro는 2026-10-01에 해지해서 **2026-10-11까지만 Pro**다. 옛 계정이 무료 플랜이 돼도
> 아티팩트는 남아 있겠지만, 복원(3번)은 그 전에 해 두는 게 안전하다.

### 개인 백업 파일

이 세션에서 아티팩트 DB 전체(장부의 `accounts`·`expenses`·`meta/roadmap`, 사업화 일정 `tasks`, 세 서비스 운영비 `costs`)를
JSON으로 내보내 **파일로 따로 전달**했다(로그인 이메일·Team ID 같은 정보가 있어 공개 저장소인 토피에는 넣지 않음 — `CLAUDE.md`
"계정 주소는 저장소 문서엔 적지 말고 장부에만" 규칙). 비밀번호 앱이나 개인 드라이브에 보관하고, 장부를 복원할 때 새 세션에 올린다.

## 2. 새 계정에서 할 일 (순서대로)

### 준비물
- **개인 백업 파일** `toffee-gelly-artifact-data-backup-2026-10-08.zip`(약 34KB, 2026-10-08 세션에서 받은 것). 안에 든 것:
  `toffee-ledger/`(사업화 장부: `accounts/` 16개·`expenses/` 10개·`meta/roadmap.json`), `toffee-launch-schedule/tasks/`(11개),
  `three-services-opcosts/`(`costs/` 14개·`settings/main.json`), `README.txt`. 파일 이름이 곧 문서 id다.
- 그 밖의 백업(아티팩트 페이지 HTML, 일정 체크 상태)은 저장소 안 `docs/handover/artifacts/`에 이미 있으니 올릴 필요 없다.

### 1단계 — 연결 (사람이 직접)
1. 새 계정으로 claude.ai 로그인 → https://claude.ai/connect-github 에서 **지금까지 쓰던 GitHub 개인 계정**으로 연결.
   `toffeechat/toffee`·`ddururiiiiiii/gelly`가 보이면 끝(안 보이면 같은 페이지에서 Claude GitHub App 설치 확인).
2. Claude Code(웹)에서 새 클라우드 환경 — 네트워크 접근 **Trusted**(npm·Prisma 설치에 필요, 비밀값·설치 스크립트는 없어도 됨).
3. 새 세션을 열 때 **저장소 두 개(`toffeechat/toffee`, `ddururiiiiiii/gelly`)를 모두 선택**한다. 운영비 데이터 페이지가 젤리 저장소에 있어서.

### 2단계 — 복원 세션 (첫 세션, 프롬프트 입력창에 zip 파일을 첨부하고 아래를 그대로 붙여넣기)

```
계정을 옮겼어. 이전 계정의 아티팩트를 이 계정으로 복원해 줘.
먼저 toffee 저장소의 docs/handover/README.md 전체와 CLAUDE.md를 읽고 시작해.

첨부한 zip은 옛 아티팩트 데이터베이스 백업이야(파일 이름 = 문서 id, 비밀번호·키는 없음).
압축은 스크래치패드의 새 빈 폴더에 풀어.

1. 아래 3개를 새 아티팩트로 게시해 줘. 페이지 HTML은 저장소 백업을 그대로 쓰고, 내용은 고치지 마.
   - 사업화 장부: toffee docs/handover/artifacts/toffee-ledger.html
     (capabilities: db, 규칙 [{"path":"","read":"view","write":"admin"}])
     데이터: zip의 toffee-ledger/accounts, expenses, meta/roadmap → 같은 컬렉션·같은 문서 id로 ArtifactData batch
   - 사업화 일정: toffee docs/handover/artifacts/toffee-launch-schedule.html (capabilities: db)
     데이터: zip의 toffee-launch-schedule/tasks → tasks 컬렉션
   - 세 서비스 운영비: gelly docs/handover/artifacts/three-services-opcosts.html (capabilities: db)
     데이터: zip의 three-services-opcosts/costs, settings → 같은 컬렉션
2. 실기기 테스트 체크리스트(toffee docs/handover/artifacts/toffee-device-test-checklist.html)도 게시해 줘
   (capabilities: db + user). 저장된 결과가 없었으니 데이터는 안 넣어도 돼.
3. 다 넣은 뒤 각 아티팩트를 다시 읽어서 문서 개수가 장부 accounts 16·expenses 10·meta 1,
   일정 tasks 11, 운영비 costs 14·settings 1인지 확인해 줘.
4. 새 주소로 바꿔 줘: toffee CLAUDE.md 5번 규칙의 장부·일정 링크, docs/product/launch-roadmap.md 맨 위 링크,
   docs/handover/README.md 3번 표(새 주소 칸 추가). 젤리 docs/handover/README.md의 운영비 링크도.
   작업 로그(docs/deployment-readiness-plan.md)에 오늘 날짜로 기록하고, 두 저장소 각각 작업 브랜치에 커밋·푸시.
5. 끝나면 새 아티팩트 주소 4개를 알려 줘. 장부 데이터의 이메일 같은 개인정보는 저장소 파일에 절대 쓰지 마.
```

> 원하면 젤리 아이디어함(gelly `docs/handover/artifacts/gelly-idea-box.html`)도 "같이 게시해 줘"라고 덧붙이면 된다(데이터 없이 페이지만).
> 나머지 젤리 아티팩트는 지난 기록이라 다시 게시할 필요 없다.

### 3단계 — 확인 (사람이 직접)
- 새 장부·일정·운영비 페이지를 열어 숫자(계정 16개, 쓴 돈 $18.70, 다음 정기 결제 2026-11-01 Railway, 1단계 체크 상태)가 예전과 같은지 본다.
- 옛 계정은 이 확인이 끝날 때까지 **삭제하지 않는다**(아티팩트·세션 기록이 같이 지워짐). Pro는 2026-10-11까지.
- (선택) 옛 계정이 살아 있는 동안 옛 아티팩트 공유 메뉴에서 새 계정 이메일을 편집 권한으로 초대해 두면 비교하기 편하다.

### 4단계 — 평소 작업 이어 가기 (두 번째 세션부터)

토피:
```
docs/handover/README.md, STATUS.md, docs/product/launch-roadmap.md를 읽고
사업화 1단계에서 남은 것과 다음에 할 일을 정리해 줘. 그다음 [하려는 일]을 하자.
```
젤리:
```
gelly docs/handover/README.md와 docs/deployment-readiness-plan.md 위쪽(다음 세션 할 일, 정정 사항 최근 항목)을 읽고
중단·보류된 작업 목록을 보여 줘. 그다음 [하려는 일]을 하자.
```
- 계정을 만들거나 돈을 썼다고 말하면 `CLAUDE.md` 5번 규칙대로 새 장부가 자동 갱신된다(4번에서 링크를 바꿔 둔 덕분).
- zip 파일은 복원 후에도 지우지 말고 보관(장부를 또 옮길 때 필요).

## 3. 아티팩트 복원 방법 (새 계정의 Claude가 따라 할 것)

| 아티팩트(옛 주소) | 백업 파일 | 데이터 | 복원 |
|---|---|---|---|
| 사업화 장부 https://claude.ai/artifact/H7cjLDgBhgGkA8xpPR4oST | `artifacts/toffee-ledger.html` | `accounts`(16건)·`expenses`(10건)·`meta/roadmap` — **개인 백업 파일** | 페이지를 그대로 게시(capabilities `db`, 규칙 `[{"path":"","read":"view","write":"admin"}]`) → `ArtifactData` batch로 문서 id 그대로 넣기 |
| 사업화 일정 https://claude.ai/artifact/KfGKHugZEmWsavMYkbwYV7 | `artifacts/toffee-launch-schedule.html` | `tasks`(11건) — `artifacts/data/*.json`(파일 이름 = 문서 id). `notes`·`expenses`는 비어 있었음 | 같은 방식(capabilities `db`) |
| 실기기 테스트 체크리스트 https://claude.ai/artifact/6oRVkwDdAgZiJtY75Yf8uV | `artifacts/toffee-device-test-checklist.html` | `results` **0건**(아직 아무 항목도 체크 안 함), 입장 코드 칸(`data/users/me/demo-code`)도 비어 있었음 | 페이지만 게시(capabilities `db` + `user`) |
| 초기 사업 로드맵(9월, Copy 포함) https://claude.ai/artifact/EDRpSJv6qkY51xUYqSfJYg | `artifacts/toffee-business-roadmap-early.html` | 체크 상태는 브라우저(localStorage)에만 있어 백업 불가 | 지금은 `launch-roadmap.md`가 대체 — 복원 불필요 |
| 초기 개발 로드맵(9월) https://claude.ai/artifact/2SSV2exLhYfW7zx7jsZP5o | `artifacts/toffee-dev-roadmap-early.html` | 위와 같음 | 지금은 `STATUS.md`가 대체 — 복원 불필요 |
| 세 서비스 운영비(젤리·KNOU·토피) https://claude.ai/artifact/NwaEj4dRqQHrCLtB4mo1vA | 젤리 저장소 `docs/handover/artifacts/three-services-opcosts.html` | 젤리 저장소(비공개) `docs/handover/artifacts/data/opcosts/` | 젤리 쪽 인수인계 참고 |

- 게시 전 `CLAUDE.md` 5번 규칙대로 **비밀번호·인증 코드·API 키는 절대 넣지 않는다**(백업에도 없음).
- 게시 후 바꿀 곳: 토피 `CLAUDE.md`(5번 규칙의 두 링크), `docs/product/launch-roadmap.md` 맨 위 링크, 작업 로그의 링크는 기록이라 그대로 둬도 됨.
- "Design System"(https://claude.ai/artifact/7VV1nWvFzpd9mTcCt7MTPD)은 빈 시스템(내용 파일 없음)이라 백업할 것이 없다.

---

## 4. 사업화 진행 상황 (2026-10-08 기준)

전체 계획은 [`docs/product/launch-roadmap.md`](../product/launch-roadmap.md)(8단계). **지금은 1단계 "계정·기반"(목표 10/1~10/18)**.

### 1단계에서 끝난 것
- 도메인 `toffeechat.app`(Cloudflare, 만료 2027-10-01 자동 갱신), 토피 전용 Gmail, `support@`·`dev@`·`privacy@` 메일 전달
- 모든 계정 비밀번호는 아이폰 암호 앱, 2단계 인증 — Gmail·Cloudflare·Expo·Sentry·Firebase·GitHub·Railway·Apple 켬
- GitHub 조직 `toffeechat`으로 저장소 이전, Claude 앱 설치
- 데모: 서버·DB Railway(싱가포르, Hobby) `api-demo.toffeechat.app`, 웹 화면 Cloudflare Pages `demo.toffeechat.app`, 데모 계정 6개·입장 코드·데모 초기화 버튼
- 소셜 로그인 5곳(구글·카카오·네이버·LINE·애플) 등록, 웹 데모에서 모두 로그인 확인. 카카오·네이버·LINE 동의 화면에 토피 로고(10/4)
- 푸시: Firebase 프로젝트·APNs 키·서비스 계정 키 → Railway. Sentry 서버 연결
- **iOS 실기기 빌드 성공·아이폰 설치(10/4)**

### 1단계에서 남은 것
- **Anthropic API 키**: 계정 가입·크레딧 $5 충전(10/2)까지 함. 남은 것 — 월 사용 한도 설정, 키 발급 → Railway `ANTHROPIC_API_KEY`
  → 웹 데모 "번역 보기" 확인 → 태국 현지 대표님께 엔진 이름 가리고 태국어 결과 확인
- **실기기 테스트**: 체크리스트 56개 항목 **아직 0개 기록**. 그 전에 데모 서버에 **파일 저장소(Cloudflare R2)** 를 연결해야
  사진·음성·영상 항목을 테스트할 수 있음 — 10/4 세션이 R2 연결 1~5단계를 안내하고 사용자 진행을 기다리다 멈춤
  (버킷 `toffee-demo`, CORS, API 토큰 → Railway `STORAGE_*` 6개 → Deploy → `/health/ready`). R2를 켜면 장부에 계정·무료 플랜 추가
- 2단계 인증 확인 필요(장부 표시 "확인 필요"): Anthropic Console, 카카오계정, 네이버(개인), LINE Developers
- 안드로이드: 테스트 기기가 생기면 빌드 + 구글·카카오·네이버·LINE에 안드로이드 서명값 등록
- Sentry 앱 소스맵 업로드 토큰(`SENTRY_AUTH_TOKEN`)은 아직

### 2단계 이후 (아직 시작 전)
- 2단계 "데모·제안 자료"(목표 10/19~11/1): 소속사 체험 계정, 데모 영상, 영문 제안서, 랜딩 페이지, 연락 목록 15~20곳
  (사업화 일정 페이지의 `s2-list` 항목은 만들어만 두고 비어 있음)
- 3단계 소속사 의견(11~12월) → 4단계 지원사업(2027년 1~3월, **신청 전 사업자 등록 금지**) → 5단계 법인 설립 → 6단계 출시 준비 → 7단계 파일럿(목표 2027년 여름)

### 돈 (장부 기준)
- 낸 것: 도메인 $8.20(10/1), Railway Hobby $5(10/1), Anthropic 크레딧 $5.50(10/2) — 영수증 보관 "확인 필요" 상태
- 다음 정기 결제: **Railway 2026-11-01**($5 + 초과 사용량, 하드 리밋 $15), 도메인 2027-10-01 $14.20
- 예정: Google Play $25·Apple(법인 전환)·법인 설립 30만~50만 원·세무 기장 월 10만~20만 원(5단계), 변호사·원어민 검수(6단계)
- Apple Developer는 젤리용 개인 계정(Team `SUA3AJW6KF`, 갱신 2027-08-14)을 같이 씀 — 법인 설립 후 법인으로 전환 예정

## 5. 중단됐거나 결정을 기다리는 것 (토피)

| 무엇 | 상태 | 이어서 할 일 |
|---|---|---|
| 작업 브랜치 3개(아래 표) | **2026-10-08 사용자 요청으로 main에 합침**(문서 충돌은 양쪽 내용을 모두 살려 정리 — `STATUS.md`는 최신 줄에 9/30 정정 두 줄 반영, `launch-roadmap.md`는 완료 체크 유지 + 🧾·🔍·🤝 체크박스 추가) | 없음 |
| 실기기 테스트·R2 연결 (10/4 세션) | 사용자 응답 대기로 멈춤 | 4번 "1단계에서 남은 것" 참고 |
| 번역 엔진 확인 | 잠정 Claude, 키 미입력 | 4번 참고 |
| Dependabot 자동 PR 10개(9/29·10/5) | 열려 있음, 검토 안 함 | TypeScript 7·ESLint 10·Vitest 5·`actions/checkout` 7 같은 **메이저 업데이트**가 섞여 있어 한 번에 합치지 말고 하나씩 CI 확인. 작은 묶음(minor·patch 2개)부터 |
| 2026-09-28 세션(세션 한도로 중단) | 영상 썸네일 앱 쪽을 하다 끊겼지만, 같은 날 커밋 `a21143f`로 완료됨 | 실기기 확인만 남음(`STATUS.md` 2차 "영상 썸네일") |
| 아이디어 보관함 | "대화방 프로필 카드에 상태메시지·배경사진" — 2차 후보, 사용자 확인 전 | 1차/2차 결정 |

2026-10-08에 main에 합친 브랜치(그 전까지 main에 없었음):

| 브랜치 | 내용 | 중요도 |
|---|---|---|
| `claude/keen-shannon-g2x32m` (10/4, 3커밋) | **`app/eas.json`에서 preview·production의 `channel` 제거**(expo-updates 없이 채널만 있어 빌드마다 설치 질문이 뜨고 멈추던 문제) + 첫 iOS 실기기 빌드 성공·로고 기록 + 실기기 체크리스트 아티팩트 기록, `ops-infra-backlog.md`에 구글 동의 화면 로고 보류 이유 | **높음** — 이게 main에 없으면 다음 빌드에서 같은 문제가 다시 남 |
| `claude/adoring-turing-t1kcnp` (9/30~10/2, 5커밋) | 사업 문서: `launch-roadmap.md`에 태국 현지 대표님께 조언 구할 시점 체크박스·버블/위버스 DM 2개월 벤치마킹·체크리스트 페이지 링크·로드맵 전용 카드/세무사 질문, `business-faq.md` 10번(설립 전 비용), `cost-overview.md`, `STATUS.md` 두 줄 정정 | 중간 — 사업화 논의 결과가 main 문서에 빠져 있음 |
| `claude/zealous-sagan-1x5no1` (10/2, 1커밋) | 작업 로그에 PR #19 반영 기록 8줄 | 낮음 |

## 6. 아티팩트 데이터가 브라우저에만 있던 것

초기 사업/개발 로드맵, 젤리 다국어 로드맵·리디자인 탐색·Jellify 목업·개발기 소재집은 체크 상태를 **그 브라우저(localStorage)** 에
저장했다. 서버에 없어서 백업할 수 없고, 새로 게시하면 체크 표시가 비어 보인다(내용은 그대로).
