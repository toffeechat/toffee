# Toffee — Claude Code 메모리

이 저장소에서 작업을 시작하기 전에 먼저 읽을 것.

## 문서 구조

- [`docs/handover/README.md`](./docs/handover/README.md) — **2026-10-08 Claude 계정 이전 인수인계**. 아래 5번의
  아티팩트 링크(사업화 장부·일정)는 2026-10-08 새 계정으로 복원한 주소다(옛 주소·복원 방법은 이 문서 3번). 계정을 또 옮기면 3번대로 다시 복원하고 링크를 바꿀 것.
- **사업 본부·소속사 아티팩트(내부용, 숫자의 기준)** — 출시 일정·가격·정산·필요 자금·서버비·정할 것은 먼저 여기서 확인할 것:
  [토피 사업 본부](https://claude.ai/artifact/6WgyADTTudgmSV3tdWvKK6)(2026-10-21 "토피 사업 계획"과 "사업화 일정"을 합침, 10-22 "운영 전환 계획"·"설립 전 지출 처리"·가격 근거도 합침 — 탭: 지금·할 일·운영 전환·정할 것·돈·서버·사업 요약·다른 페이지. 2027년 2월 전 세계 출시·태국·필리핀 집중, 앱 언어 9개, ฿149, 정산 60/40 + 창립 파트너 70/30, 11/30 판단),
  [토피 소속사](https://claude.ai/artifact/LGkCkGRdmGSF2xdvKXQqwp)(10-22 "소속사 제안"과 "소속사 연락처"를 합침 — 반응 단계·미팅 질문·내부 제안 조건·메일 문구). 소속사 공식 비즈니스 연락처(1차 7곳·2차 후보)는
  이 페이지에만 둔다(저장소 문서엔 연락처 값을 적지 않음). 외부용 제안서는 [한국어판](https://claude.ai/artifact/PL7ENDwuzCHg2YiYv9zgNg)이 기준본(2026-10-25 사용자 확정)이고, 보내는 판은 그걸 옮긴
  [태국어판](https://claude.ai/artifact/XnSDy1apquNFCnAvcYWmv2)·[영어판](https://claude.ai/artifact/JWpjw259Xgfb1Ab321t3mi)(2026-10-25 — 메일에 두 PDF를 같이 첨부, 15쪽만 소속사별로 바꿔 받음).
  한국어판을 고치면 두 판도 같이 고칠 것(옛 태국어·영어판은 10-22 삭제, 백업 `docs/handover/artifacts/decks/`).
  **아티팩트는 이 셋 + 제안서 태국어·영어판 + 사업화 장부·실기기 테스트·세 서비스 운영비, 모두 8개로 유지**(2026-10-22 사용자 요청 6개 — 1인 사업이라 한눈에, 10-25 보내는 판 둘 추가). 새 내용은 되도록 기존 페이지의 탭·구역으로 넣고, 새 아티팩트는 꼭 필요할 때만. 한국어 메일 문구 기준본도 이 페이지(한국어로 확정 → 마지막에 태국어·영어). **외부용 자료(랜딩·멘토 요약)에는
  이 숫자를 그대로 옮기지 않는다**(2026-10-19 사용자 결정). 단 **소속사 제안서·소속사 메일은 2026-10-23 사용자 결정으로 정가(฿149·첫 달 ฿99·CP방 ฿199, 메일은 비율만)와
  정산 비율(창립 파트너 3곳 첫 12개월 70% → 그 뒤 60%)을 공개**한다(2026-10-25 확인 — 제안서 13쪽 메모·소속사 페이지 "제안 조건"). `launch-roadmap.md`는 이 계획과 맞출 것.
- [`STATUS.md`](./STATUS.md) — **진행 현황 한눈에 보기**(1차 완성/2차/보류, 기능별 ✅🔶⬜👤).
  사용자가 "어디까지 됐지?"를 매번 묻지 않아도 되게 하는 게 목적(2026-09-28 도입). 기능을
  만들거나 상태가 바뀌면 **같은 커밋에서** 해당 줄을 갱신하고 "마지막 갱신" 날짜를 바꿀 것.
  사용자가 새 기능을 요청하면 1차 목록에 없는 한 바로 만들지 말고 "아이디어 보관함"에 적은 뒤
  1차/2차 중 어디에 넣을지 먼저 확인할 것(1차 범위가 계속 늘어나는 걸 막기 위함).
  **아이디어 보관함은 사업 본부 "아이디어" 탭에도 보인다**(2026-10-22 — 원본은 STATUS.md, 탭은 사본): 보관함을 고치면 같은 작업에서 탭의 "아직 정하지 않은 아이디어"
  표도 맞춘다(1차로 정해 만든 건 표에서 빼서 탭 맨 아래 "완료한 아이디어" 목록으로 옮기고 완료 날짜를 붙인다 — 2026-10-22 사용자 요청). 사용자가 탭에서 직접 적은 아이디어는 `ideas` 컬렉션(`{text, status: "new"|"moved", createdAt, memo}`)에 쌓이니,
  세션을 시작할 때 `status: "new"`인 것을 읽어 STATUS 보관함으로 옮기고 `status: "moved"` + `memo`로 표시한 뒤 1차/2차를 묻는다.
- **정책 결정이 필요한데 개발을 막을 때**(환불·제재 기준처럼 사업·법률 판단이 필요한 것): 사용자에게
  하나하나 확정을 요구하지 말고, 근거와 함께 **추천안을 잠정 결정으로 적용**해서 개발을 계속한다 —
  `STATUS.md` "출시 전 확정할 정책" 표에 추가하고, 나중에 바꾸기 쉽게(설정값·문구 수준) 만든다
  (2026-09-28 사용자 방침: 결정 부담 때문에 진도가 안 나가는 걸 피하기 위함). 되돌리기 어려운 것
  (스키마 대공사, 외부 계약·비용 발생)은 예외로 먼저 묻는다.

- **기능을 만든 뒤엔 실기기 테스트 아티팩트까지**(2026-10-22 사용자 요청) — [토피 실기기 테스트](https://claude.ai/artifact/7yFZj5kvHj1rCtfjQ7GrUc)에 넣을
  만한지(사람이 데모·폰에서 확인할 화면·흐름이 있는지) 판단해 HTML `ROLES` 배열에 항목을 추가·수정하고, Claude가 직접 확인할 수 있는 부분(로컬 서버·웹, PC/폰 폭)은
  확인한 뒤 `results/<id>`에 `{status, note: "[Claude 날짜 어디서] …", updatedAt}`로 결과를 남긴다(폰·실결제처럼 못 하는 건 status 없이 이유만). 쓰기 전에 기존 결과를 읽을 것.
- **테스트·작업 중 발견한 오류는 바로 고친다**(2026-10-20 사용자 방침) — "개선 후보"로만 적고 넘어가지 말 것. 고칠지 판단이 필요한
  기획 결정(기능 동작을 바꾸는 것)이면 먼저 작업 로그·`feature-decisions.md`·STATUS에서 이미 정한 게 있는지 확인하고(체크리스트·옛 문구만 보고 판단하지
  않기 — 10-20 사진 묶음 회수를 잘못 고친 일), 정한 게 없으면 위 "정책 결정" 방침대로 추천안으로 고친다.
- [`docs/product/`](./docs/product/) — 기획/디자인 문서. **개발자가 아니어도 읽을 수
  있게** 쓴다(사업 파트너, 디자이너, 나중에 합류할 비개발자 팀원 기준).
- [`docs/engineering/`](./docs/engineering/) — 기술 문서. 개발자가 이해할 정도면
  충분하다 — 코드 경로, 함수명, 스키마를 그대로 써도 됨.
- [`docs/deployment-readiness-plan.md`](./docs/deployment-readiness-plan.md) — 세션마다
  쌓이는 날짜순 작업 로그(로드맵 문서). "지금 무엇을 왜 했는지"는 여기, "지금 기준
  최신 상태가 뭔지"는 위 두 폴더에 정리한다.

### 문서 자동 업데이트 — 사용자가 별도로 요청하지 않아도 항상 할 것

비중 있는 작업(기능 결정, 아키텍처 변경, 스키마 변경, 디자인/브랜드 확정 등)을
마치면, 다음을 **묻지 않고 그때그때** 한다:

1. `docs/deployment-readiness-plan.md`에 그날 날짜로 무엇을 왜 했는지 기록(기존
   항목들과 같은 톤 — 원인, 결정, 남은 일).
2. 그 결정이 **제품/기획 성격**이면 `docs/product/`의 관련 문서(`feature-decisions.md`,
   `brand-guide.md` 등)를 새로 만들거나 기존 문서를 업데이트 — 로그에만 남기고 끝내지
   않는다. 비개발자가 읽어도 이해할 수 있는 문장으로 쓴다.
3. 그 결정이 **기술/구현 성격**이면 `docs/engineering/architecture-notes.md`(또는
   주제가 커지면 새 파일)를 업데이트 — 개발자 기준으로 쓰면 되고, 전문 용어나 코드
   경로를 굳이 풀어 쓸 필요 없다.
4. 운영·인프라·사업 쪽 결정(계정, 호스팅, 외부 서비스 가입, 계약 등)은 **결정만 기록하고
   실제 작업은 미룬다** — [`docs/product/ops-infra-backlog.md`](./docs/product/ops-infra-backlog.md)에
   추가할 것(2026-09-28 사용자 방침: 기능 개발 먼저). 기능 개발이 외부 계정 때문에 막히면
   로컬 대체품(가짜 S3, 키 없는 Sentry 등)으로 우회하고 계정 정보만 나중에 넣게 만든다.
5. **외부 서비스 계정을 만들었거나 돈을 썼다는 말을 들으면**(가입, 2단계 인증 설정, 로그인 이메일 변경, 결제,
   정기 결제 갱신 등) 묻지 않고 **사업화 장부** 아티팩트 https://claude.ai/artifact/RinLbRwEas5gqHdZ7PzzHR 를
   `ArtifactData`로 갱신한다(2026-10-01 사용자 요청).
   - `accounts`(문서 하나 = 서비스 하나): `service`, `category`, `stage`(사업화 단계 1~8, `launch-roadmap.md`),
     `status`(`done`/`todo`), `when`, `login`, `method`, `purpose`, `recovery`, `twofa`(`on`/`off`/`unknown`),
     `created`, `updated`, `url`, `note`, `order`.
   - `expenses`(문서 하나 = 결제 한 건 또는 예정 비용 하나): `item`, `category`, `stage`, `status`(`paid`/`planned`),
     `amount`(숫자) + `currency`(`USD`/`KRW`) 또는 예정이면 `estimate`(글), `krw`(카드 청구 원화, 알면), `cycle`,
     `date`, `renews` + `renewAmount`(정기 결제면), `payer`, `receipt`, `note`, `order`. 정기 결제가 갱신되면 새
     문서를 추가(연도별 기록 유지).
   - `meta/roadmap`: `current`(지금 단계) + `stages`. 단계가 넘어가면 `current`를 바꾼다.
   - **사업 본부**(옛 사업화 일정) 아티팩트 https://claude.ai/artifact/6WgyADTTudgmSV3tdWvKK6 (`docs/product/launch-roadmap.md`를 옮긴
     체크리스트 + 사업 계획 숫자)도 같이 갱신한다 — 숫자·결정이 바뀌면 "정할 것"·"돈"·"서버" 탭 HTML도 고친다: 할 일이 끝나거나 진행되면 `tasks/<할 일 id>`(예: `s1-domain`, `s1-mail`, `s1-accounts` —
     id는 아티팩트 HTML의 `STAGES` 배열)에 `{done, doneAt(ISO), note}`를 쓰고(일부만 했으면 `done: false` + 진행 메모),
     `launch-roadmap.md`의 체크박스도 같은 커밋에서 맞춘다. 사용자가 페이지에서 직접 체크·메모한 것도 있으니 쓰기 전에 읽고
     `if_version`으로 덮어쓰지 않게(2026-10-01 사용자 요청).
   - **비밀번호·인증 코드·API 키·주소 같은 개인정보는 절대 적지 않는다.** 계정 주소는 저장소 문서엔 적지 말고
     장부에만 둔다.
6. 이 저장소는 git에 커밋되므로, 이 규칙은 계정/세션이 달라도(다른 사람이 이 레포를
   Claude Code로 열어도) 자동으로 적용된다 — 세션 로컬 설정에는 이런 규칙을 넣지 말 것.

## 세션 환경

- `node_modules`가 커밋되어 있지 않음 — `backend/`, `app/` 각각에서 `npm ci` 먼저 실행해야 `tsc`/lint/`prisma`
  커맨드가 동작함.
- 이 원격 세션엔 DB 연결이 없는 경우가 많음 — `npx prisma migrate dev`는 못 씀.
  스키마를 고치면 `npx prisma format` → `npx prisma generate` → `npx prisma validate`로
  검증하고, 마이그레이션 SQL은 `prisma/migrations/`의 기존 파일을 본떠 손으로 작성할
  것. 파일명은 `YYYYMMDDHHmmss_설명` 형식.
- 커밋 전엔 최소 `backend`: `npx tsc --noEmit`, `npm run lint`(oxlint), `npm test`, `npx nest build`
  / `app`: `npx tsc --noEmit`, `npx eslint src`, `npm test` 통과를 확인할 것(화면 흐름을 바꿨으면 서버·웹을 띄우고 `npm run e2e`도). GitHub Actions CI(`.github/workflows/ci.yml`)는
  Actions 무료 시간을 아끼려고 **main 대상 PR/push에서만** 자동으로 돎(작업 브랜치 push에선 안 돎,
  2026-09-28) — 그래서 스키마를 바꿨다면 로컬 Postgres에 `prisma migrate deploy` 후
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`로
  드리프트 검사까지 직접 할 것. main 반영은 사용자가 요청할 때만(배포 요청 포함 — 아래 "배포 규칙"). 백엔드는 ESLint가 아니라 oxlint라 `npx eslint src`를 치면 설정 파일이 없다고
  실패함(정상). 앱 `tsc`가 `*.module.css`/`global.css` 타입을 못 찾는다고 실패하면
  gitignore된 `app/expo-env.d.ts`가 없는 것 — `/// <reference types="expo/types" />`
  한 줄로 만들어 주거나 `npx expo start`를 한 번 띄우면 자동 생성됨.

## 배포 규칙 (2026-10-25 — 2027년 2월부터 1인 운영, 폰에서 말로 배포)

절차는 `.claude/skills/deploy/SKILL.md`(deploy 스킬), 사람용 런북 `docs/engineering/deploy-runbook.md`, 비개발자 요약 `docs/product/deploy-guide.md`.

- **환경 두 개**: 프리뷰 = 데모 서버·DB(Railway `toffee-demo`, `api-demo.toffeechat.app`) + 웹 `demo.toffeechat.app` + 앱 OTA `preview` 채널
  (소속사 시연용 겸함, main을 자동 배포) / 프로덕션 = 운영 서버·DB `api.toffeechat.app` + 웹 `app.toffeechat.app` + 앱 OTA `production` 채널
  (아직 없음 — 사업 본부 "운영 전환" 탭). 워크플로 `deploy-preview.yml`·`deploy-production.yml`(둘 다 수동 실행, 운영은 사용자 승인).
1. **대상 판단**: 대상을 말하지 않은 "올려/적용/반영"은 **프리뷰**. "운영·실제 사용자·프로덕션·스토어"가 분명할 때만 프로덕션. 애매하면 한 줄로 되묻기.
   정해진 말("프리뷰에 반영해")을 기다리지 말고 뜻으로 알아들을 것. 배포해 달라는 말 = main 반영 허락.
2. **무엇을 올릴지는 바뀐 파일로 Claude가 판단**(`scripts/deploy/plan.mjs`): 서버 코드 → 서버 배포, 스키마 → 마이그레이션(서버 배포와 함께, 켤 때 적용),
   앱 JS → OTA(`app/scripts/ota.mjs`만 — `eas update` 직접 금지), 네이티브 → 새 빌드 + 스토어 제출(**심사가 필요하다고 먼저 알림**), 웹 → Pages.
   순서: 서버 → 웹 → OTA(백엔드가 같이 바뀌면 서버 배포가 끝난 뒤 OTA). **버전업·네이티브 변경 전에 쌓인 JS 수정은 먼저 OTA**(젤리 2026-08-26 사고).
3. **프로덕션엔 프리뷰에서 확인한 같은 커밋만**(커밋 상태 `deploy/preview` — 워크플로가 검사). 급한 수정도 프리뷰를 거치되 확인을 짧게(자동 점검 통과면 바로).
4. **DB 데이터 직접 수정 금지**: 운영 DB에 임의 SQL 금지, 운영자 화면 기능으로 처리. 꼭 필요하면 `ops/data-fixes/` SQL 커밋 →
   `db-data-fix-production.yml`(백업 → 미리보기 → 승인 2번)로만.
5. **마이그레이션은 "추가 먼저, 제거는 다음 배포"**: 컬럼·표 삭제·이름·타입 변경은 코드가 안 쓰게 된 다음 배포에서. 옛 앱 버전이 새 서버로 계속 동작해야 함
   (응답 필드 빼지 않기, 새 요청 필드는 선택값). `minVersion` 강제 업데이트는 정말 필요할 때만(먼저 묻기). 운영 워크플로는 위험한 마이그레이션이면 멈춤.
6. **배포 후 자동 점검**(헬스·로그인·메시지 보내기/받기/답장·웹, `scripts/deploy/smoke.mjs`)과 Sentry 새 오류를 보고하고, 실패하면 되돌리기를 제안.
   배포를 피할 시간(`scripts/deploy/policy.json` — 데모 새벽 초기화, 운영은 태국 19~01시)·**소속사 미팅 직전 데모 배포 금지** — 미팅 일정을 들으면
   `freezes`에 추가. main에 합치는 순간 데모가 배포되므로 **합치기 전에** 확인.
- 비밀값은 GitHub Secrets·Railway·EAS에만(저장소·대화에 적지 않음). 사용자가 할 설정은 `ops-infra-backlog.md` "배포 자동화".

## 코드 컨벤션

- 젤리(gelly)의 설계 패턴을 참고하되 그대로 따라가지 않는다 — ID 필드 검증
  (`@IsUUID()` 대신 `@IsString()+@IsNotEmpty()`), `ValidationPipe`
  (`whitelist/forbidNonWhitelisted/transform`) 같은 도메인과 무관한 일반 엔지니어링
  위생은 그대로 가져오고, `*EditProposal`(제안-승인) 패턴처럼 젤리의 특정 도메인
  (일정/장소 관리)에 묶인 패턴은 억지로 따라가지 않는다. Sentry/CI/EAS 멀티프로필/
  헬스체크 분리처럼 사업 모델과 무관한 운영 인프라도 젤리를 출발점으로 삼는다.
- **단, 젤리는 참고만 한다(2026-09-28 사용자 방침)** — 토피는 실제 운영되는 **유료 서비스**라 젤리(무료
  커뮤니티 앱)에서 괜찮았던 단순화를 그대로 가져오지 말고 유료 기준으로 다시 판단할 것. 예: 젤리는 계정당
  푸시 기기 1대였지만 토피는 여러 기기 + 묶음 발송(`PushDevice`), 결제·환불·콘텐츠 유출·개인정보는 항상
  더 엄격한 쪽으로.
- 브랜드 톤·컬러·타이포는 `docs/product/brand-guide.md` 기준을 따른다 — 새 화면을
  만들 때 마음대로 색을 새로 정하지 말 것.
