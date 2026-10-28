# 운영·인프라 결정과 보류 작업 목록

**원칙 (2026-09-28 확정)**: 운영·인프라·사업 관련은 **"어떻게 할지"만 정해서 여기 적어두고,
실제 작업(계정 만들기, 결제 등록, 이전, 계약 등)은 기능 개발을 먼저 채운 뒤에 한꺼번에**
한다. 개발자가 혼자라 코드가 아닌 일에 시간을 쪼개면 기능 개발이 계속 밀리기 때문.

- 기능 개발이 이런 작업에 막히지 않도록, 개발 중에는 **실제 계정 대신 로컬 대체품**을 쓴다
  (예: 파일 저장소는 R2와 같은 방식으로 동작하는 로컬 가짜 저장소, Sentry는 키 없이 꺼진 채로).
  나중에 실제 계정 정보만 넣으면 그대로 동작하게 만든다.
- **예외 — 날짜가 정해진 것은 미루지 않는다.** 아래 "시기 놓치면 안 되는 것"은 기능 개발
  중이라도 날짜에 맞춰 챙긴다.
- 새로 결정하거나 미룬 운영 작업이 생기면 이 문서에 추가한다(로드맵 로그에만 두지 않기).

---

## 시기 놓치면 안 되는 것

| 무엇 | 언제 | 비고 |
|---|---|---|
| 예비창업패키지 공고 확인·신청 | 2027년 1~3월(통상) | **신청 전엔 사업자 등록 금지**(등록하면 자격 상실). 자세한 건 [`business-compliance-checklist.md`](./business-compliance-checklist.md) 5번 |
| D-U-N-S 번호 신청 | 법인 설립 직후 바로 | 발급에 몇 주 — 애플·구글 법인 계정의 선행 조건. 전체 순서는 [`launch-roadmap.md`](./launch-roadmap.md) |
| 도메인 선점 | 가능하면 일찍 | 원하는 이름이 먼저 팔릴 수 있음. 연 1~2만 원 수준 |

---

## 1. 계정·소유 구조 — 결정 (2026-09-28)

지금은 사업자가 없어서 개인 명의로 시작하지만, **나중에 회사로 통째로 넘기기 쉬운 구조**로
만든다. 법인 설립 후엔 "소유자/결제 정보만 바꾸는" 작업이 되게 하는 게 목표.

- **토피 전용 이메일**: 개인 이메일 대신 토피 전용 주소로 모든 서비스에 가입한다. 도메인을
  사서 `dev@도메인` 같은 주소를 만들고(Cloudflare 무료 이메일 전달로 개인 메일함에서 받기),
  도메인이 부담되면 토피 전용 Gmail을 새로 만든다.
  - **2026-10-01 진행**: 토피 전용 Gmail 생성 완료(2단계 인증 켬). 도메인은 **`toffeechat.app`**으로 결정·구매 완료(개인 명의 등록 → 법인 설립 후 등록자 변경)
    (`toffeechat.com`·`toffeeapp.com`·`gettoffee.com`·`trytoffee.com`은 이미 팔림) — Cloudflare에서 첫해
    8.20달러, 이후 연 14.20달러. 메일 주소는 용도별로 `support@`(고객 문의·스토어 연락처), `dev@`(개발 서비스
    가입), `privacy@`(개인정보처리방침)를 만들고 전부 Gmail 하나로 전달한다. Cloudflare 로그인 이메일은
    도메인 주소로 바꾸지 말고 Gmail로 유지(도메인이 끊기면 계정 복구 메일도 못 받으므로).
  - **어떤 서비스에 어떤 계정으로 가입했는지, 단계별로 쓴 돈은 "사업화 장부"에 정리**:
    https://claude.ai/artifact/RinLbRwEas5gqHdZ7PzzHR (비공개, 비밀번호는 적지 않음). 계정을 만들 때마다
    결제할 때마다 Claude가 자동으로 갱신한다.
- **GitHub**: 무료 Organization(사업자 없이 만들 수 있음)을 만들어 `toffee` 저장소를 옮긴다. **2026-10-01 완료** — 조직 `toffeechat`(개인 소유로 등록, 법인 후 변경), 저장소 `toffeechat/toffee`.
  이력·이슈는 그대로 유지되고 예전 주소는 자동 연결된다. 인력이 생기면 Organization 멤버로
  초대해 권한을 나누고, 법인 설립 후 결제 정보만 법인으로 바꾼다.
  (옮긴 뒤 Claude로 작업하려면 새 Organization에 Claude GitHub App 설치 필요.)
- **인프라 서비스**(Cloudflare, Sentry, Expo 등): 전부 토피 전용 이메일로 가입. 사람이 늘면
  각자 계정을 멤버로 초대(비밀번호 공유 X).
- **보안**: 비밀번호 관리자 사용, 모든 계정 2단계 인증.
- **결제**: 당분간 개인 카드 OK. **영수증은 전부 따로 모아둘 것** — 지원사업은 보통 협약 전
  지출을 인정하지 않지만, 법인 설립 후 정리할 때 필요.
- **코드·자산 소유권**: 지금 만든 코드는 법적으로 개인 소유. 법인 설립 시 회사로 넘기는
  절차(양도 계약·현물출자 등)가 필요 — 투자·지원사업 심사에서 "회사 자산"으로 인정받으려면
  중요. **법률·세무 전문가 확인 필요.**
- **젤리 사업·앱스토어 계정 — 결정(2026-09-29 개정, 사용자 확정)**: 젤리도 **토피 법인 하나로 합친다**(젤리용 개인사업자를
  따로 내지 않음). 젤리에 중고거래를 붙이려면 어차피 사업자(통신판매중개업 신고)가 필요한데, 젤리로 개인사업자를 먼저 내면
  예비창업패키지 자격이 없어지고 나중에 토피 법인이 "신규 창업"으로 인정받지 못할 위험이 있고, 장부·세무도 두 벌이 되기 때문.
  (같은 날 앞서 적었던 "개인 계정은 젤리 전용으로 두고 토피는 법인 명의 새 애플 계정" 결정은 젤리가 개인 앱으로 남는다는
  전제였어서 이걸로 대체.)
  - **법인 설립 전**: 젤리는 지금처럼 개인 계정·개인 운영 그대로. **젤리 중고거래 기능은 법인 설립 후에 출시**(사업자가 있어야
    통신판매중개업 신고 가능, 그 전에 사업자를 내면 예비창업패키지 자격 상실).
  - **애플**: 법인 설립 후 지금의 **개인 개발자 계정을 법인(Organization)으로 전환** — 같은 팀이 유지돼 젤리 앱·애플 로그인 회원
    식별값이 그대로이고 판매자 이름만 법인명으로 바뀜. 토피 운영 앱도 **전환이 끝난 뒤 이 계정에** 등록 → 애플 계정 하나(연 $99)로
    두 앱 운영. 전환에는 D-U-N-S 번호(무료, 발급 몇 주) 필요.
  - **구글**: 개인 계정은 유형을 바꿀 수 없어서 **법인 명의 조직 계정을 새로**(1회 $25) 만들어 토피를 올리고, 젤리는 플레이
    콘솔의 **앱 이전** 기능으로 옮긴다(이전 시 로그인·구독 영향은 그때 최신 문서로 확인).
  - 그 전 **토피 내부 테스트는 개인 계정에서 개발용 번들 ID(`…app.dev`)로만**(TestFlight 내부 테스트·구글 내부 테스트).
    **운영 번들 ID(`com.toffeechat.app`)는 법인 전환 전에 등록하지 말 것** — 개인 상태에서 올리면 스토어에 개인 이름으로
    판매되고, 구글은 개인 계정에서 옮기는 작업이 따로 필요해짐.
  - 감수하는 점: 같은 법인이라 젤리 중고거래 분쟁 책임이 토피 법인에도 걸림 — 규모가 작을 땐 법인·세무 비용을 한 번만 내는
    이득이 더 크다고 판단.
  - 그 밖의 서비스(Firebase·Sentry·Cloudflare·Expo·카카오/네이버/라인 개발자·Resend·GitHub Organization)는 지금 **토피 전용
    이메일로 새로** 만든다(젤리 계정과 섞지 않음 — 나중에 회사로 넘길 때 통째로 넘기기 쉽게). 전부 무료로 시작 가능.

- **소셜 로그인 계정(2026-09-29)**: 구글·애플·네이버·카카오·라인 모두 **무료**, 사업자 없이 개인으로 만들 수 있음(애플만
  개발자 계정 연 $99). **중요 — 나중에 법인으로 바꿀 때 새 앱/프로젝트를 만들지 말고 기존 것의 소유자·회사 정보만 바꿀 것.**
  각 서비스가 주는 회원 식별값이 "앱(애플은 개발자 팀, 라인은 Provider)"마다 달라서, 새로 만들면 기존 회원이 다른 사람으로
  인식돼 로그인이 끊김. 애플은 개인 → 법인 **계정 전환**(같은 팀 유지)을 쓰고, 다른 팀으로 **앱 이전**은 피할 것(이전하면
  애플 로그인 회원 식별값을 옮기는 별도 작업 필요). 라인은 Provider 이름이 사용자에게 보이니 "Toffee"로.
  카카오는 이메일을 받으려면 비즈 앱 전환 필요(개인 개발자도 본인 인증으로 가능 — 가입 때 최신 정책 확인),
  네이버는 공개 전 검수 요청. 모두 개인정보처리방침 주소가 필요 → 도메인·약관 페이지가 먼저.

- **GitHub 조직(2026-10-28)**: 지금은 토피·검볼(`toffeechat/gumball`, 비공개, 10-28 사용자가 만듦) 모두 `toffeechat` 조직. **법인(디저트랩) 설립 후**
  회사 이름 조직(예: `dessertlab`)을 새로 만들어 토피·검볼·젤리 저장소를 Transfer로 옮긴다(커밋 기록 유지, 옛 주소 자동 연결).
  옮길 때 다시 연결: Claude GitHub 앱 설치, Railway·EAS·Cloudflare 연결, Actions Secrets. 조직 이름 변경도 가능하지만 토피 전용 이름이 회사 이름이 돼 비추천.
  참고: Claude GitHub 앱은 조직에 저장소를 새로 만드는 권한이 없음(403) — 새 저장소는 사람이 만든다.

## 2. 인프라

| 항목 | 결정 | 미뤄둔 작업 |
|---|---|---|
| 파일(사진·음성·영상) 저장소 | **Cloudflare R2 (추천안, 2026-09-28)** — 팬에게 보내는 전송 비용이 무료라 영상 방송형 서비스에 가장 유리. S3와 같은 방식이라 나중에 바꾸기도 쉬움. **서버 코드는 완료** — 계정 정보만 넣으면 동작. **데모 서버는 2026-10-13 연결 완료**(버킷 `toffee-demo`) | 운영 서버를 만들 때 운영용 버킷(예: `toffee-media`)·토큰을 따로(데모와 섞지 않음), CORS는 운영 웹 주소로. 처음 하던 안내: Cloudflare 계정 + R2 활성화(결제수단 등록, 월 10GB 무료), **비공개** 버킷 생성(예: `toffee-media`), API 토큰 발급 → 백엔드 `STORAGE_*` 환경변수 입력. 웹 버전에서도 올리려면 버킷 CORS 허용 설정 |
| 데모 서버 확인할 것(2026-10-12 실기기 테스트에서 나옴) | 코드는 고침 — 아래는 설정 | ~~① R2 연결~~ **2026-10-13 완료**(R2 무료 플랜, 비공개 버킷 `toffee-demo` + CORS `https://demo.toffeechat.app` GET·PUT·HEAD, Account API 토큰 `toffee-demo-server` Object Read & Write·이 버킷만·만료 없음 → Railway `STORAGE_*` 6개, 시작 로그에 저장소 경고 없음) ~~② `SUPPORT_EMAIL`~~ 10-13 완료(`ANTHROPIC_API_KEY`·`FIREBASE_SERVICE_ACCOUNT_JSON`도 들어가 있음 — 시작 로그 경고 없음) ③ 푸시: 서버 키는 있으니 새 빌드로 받아 보고 Railway 로그 "FCM 발송 … 실패 (코드)" 확인(코드가 `third-party-auth-error`면 Firebase의 APNs 키 문제) ④ 카카오 콘솔 네이티브 앱 키에 iOS 번들 ID `com.toffeechat.app.dev`, LINE 채널 iOS 번들 ID 확인 ⑤ main 반영 후 데모 초기화(가상 아티스트 사진·추가 아티스트가 들어감) |
| 데모 서버 운영자 입장 코드(2026-10-14) | 운영자 계정은 일반 입장 코드로 못 들어가게 별도 코드 `DEV_LOGIN_ADMIN_CODE`(코드 완료) | 👤 Railway 데모 서버 변수에 `DEV_LOGIN_ADMIN_CODE`를 일반 입장 코드와 **다른 값**으로 넣기(넣기 전엔 데모에서 운영자 로그인 불가). 값은 저장소에 적지 말 것 |
| 데모 접속 알림 메일·자동 초기화(2026-10-19) | 소속사별 입장 코드로 들어오면 운영자에게 메일(30분 넘게 쉬었다 오면 한 통씩), 데모 매일 새벽 자동 초기화 — **코드 완료, 2026-10-19 설정 완료·메일 도착 확인**(Resend: 토피 Gmail 구글 로그인, 도메인 `toffeechat.app` Tokyo 지역 Cloudflare 자동 설정으로 인증, 발송 전용 키 → Railway 4개 변수) | ~~👤 ① 메일 발송 서비스 **Resend** 가입(토피 전용 이메일, 무료 — 하루 100통·월 3,000통) → 도메인 `toffeechat.app` 인증(DNS 레코드 추가) → API 키 발급 ② Railway 데모 서버 변수: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`(예: `no-reply@` 도메인 주소), `DEMO_ALERT_EMAIL`(알림 받을 주소 — 저장소에 적지 말 것), 자동 초기화를 쓰려면 `DEMO_DAILY_RESET=true` ③ 서버·웹 데모 다시 배포 후 운영자 화면 › 데모 입장 코드에서 소속사별 코드 등록. Resend는 보호자 동의 메일에도 쓰이므로 가입하면 사업화 장부에 추가~~ 끝. 운영 서버를 만들 땐 같은 Resend 계정에 운영용 키를 따로 |
| 푸시 알림(Firebase) | 코드 완료(2026-09-28), **프로젝트 `toffee-c6cba` 생성(2026-10-01, 애널리틱스 끔)** | ~~Firebase 프로젝트 생성~~ → ~~개발용 앱(`com.toffeechat.app.dev`) 등록·설정 파일~~(2026-10-01 완료) → 서비스 계정 키를 백엔드 `FIREBASE_SERVICE_ACCOUNT_JSON`에, 앱용 `google-services.json`(안드로이드)·`GoogleService-Info.plist`(iOS)를 `app/`에 넣기, 애플 푸시 인증 키(APNs)를 Firebase에 등록. 앱 식별자(번들 ID·패키지명)도 아직 미정 — 스토어 빌드 전에 정할 것 |
| 에러 모니터링 | Sentry (코드 연동 완료, **2026-10-01 조직 `toffeechat` 가입, 프로젝트 `toffee-app`·`toffee-backend` 생성**) | 앱 DSN은 `app/eas.json`(preview·production)에 넣음 — 남은 것: **서버 호스팅 환경변수 `SENTRY_DSN`**에 `toffee-backend` DSN 넣기(Sentry → toffee-backend → Settings → Client Keys에서 복사), 앱 소스맵용 `SENTRY_AUTH_TOKEN`(EAS 비밀 환경변수, 실기기 빌드 전에). **2026-10-25 추가(유료 운영 안정성)**: ① Sentry 알림 규칙 — 새 오류가 처음 생기면·한 오류가 1시간에 N번 넘으면 메일/폰 앱(Sentry 앱) 알림 ② 서버 `SENTRY_ENVIRONMENT=demo`/`production` 구분 ③ 서버가 아예 죽은 건 Sentry가 못 알려 주니 **가동 감시**(UptimeRobot·Better Stack 무료 등으로 `/health/ready` 1~5분마다, 실패 시 메일·푸시) ④ Railway 사용량 알림(메모리·비용) |
| 운영자 홈 "최근 오류"·오류 알림(2026-10-25) | 코드 완료 — 서버가 Sentry API로 미해결 오류를 5분마다 가져와 운영자 홈 카드에 보여 주고, 새 오류·1시간 30번 이상이면 운영자 알림(메일·푸시, 종류 `ERROR`). 단계별 방법은 [`error-monitoring-guide.md`](./error-monitoring-guide.md) | ~~① Sentry 개인 토큰 → Railway `SENTRY_API_TOKEN`~~ **2026-10-25 데모 서버 완료**(카드에 실제 목록 확인, 조직은 미국 지역이라 `SENTRY_API_URL` 불필요) ~~② 서버 `SENTRY_DSN`~~ 10-02에 이미 넣음(`SENTRY_ENVIRONMENT=demo`). 운영 서버를 만들 땐 같은 토큰 또는 새 토큰 + `SENTRY_ISSUES_ENVIRONMENT=production` ③ 데모·운영을 나눠 보려면 `SENTRY_ISSUES_ENVIRONMENT` ④ Sentry 자체 알림 규칙(새 오류·1시간 100번) — 운영 서버 만들 때(1월, 운영 전환 2단계) ~~⑤ 가동 감시 UptimeRobot~~ **2026-10-25 완료**(토피 Gmail로 가입, 데모 서버·DB·웹 3개 5분 감시 — 운영 서버 생기면 그 주소도 추가, 무료 플랜 상업적 사용 규정은 그때 다시 확인) — `/health`·`/health/ready`·웹 데모 주소(가입하면 사업화 장부에) |
| GitHub Actions 사용 시간 | CI는 main에 올릴 때만 실행(2026-09-28) — 무료 시간이 젤리와 합산돼 한도가 찼음 | Organization으로 옮기면 무료 시간이 따로 잡힘(위 1번과 같이 처리). 필요하면 지출 한도 설정 확인 |
| 의존성 취약점 알림 | Dependabot (설정 파일 추가 완료) | GitHub 저장소 설정에서 알림 켜져 있는지 확인 |
| 백엔드 호스팅 / DB | **Railway로 결정(2026-10-01)** — 서버+PostgreSQL, 싱가포르 리전. 데모 월 $5~10 예상. 웹 데모 화면은 Cloudflare Pages(무료), 주소 `demo.toffeechat.app`·`api-demo.toffeechat.app`(잠정). 코드 쪽은 준비 끝(2026-09-29). **2026-10-01 가입·2단계 인증·Hobby(월 $5) 결제, 데모 서버·DB 첫 배포 성공**(프로젝트 `toffee-demo`, 임시 주소 `toffee-production.up.railway.app`, `NODE_ENV=development`). 웹 데모는 Cloudflare Pages, 주소 `demo.toffeechat.app`(화면)·`api-demo.toffeechat.app`(서버) 연결 완료(2026-10-02), 배포 설정 `backend/railway.json` | 호스팅 고르기(Docker 이미지를 돌릴 수 있는 곳이면 됨: Railway·Render·Fly.io 등) + 관리형 Postgres(자동 백업). 올릴 때: `backend/Dockerfile`로 배포, 환경변수는 `backend/.env.example` 그대로(빠지면 서버가 켜질 때 로그에 알려 줌), 헬스체크 `GET /health`(살아 있는지)·`/health/ready`(DB까지), 서버 여러 대면 `RUN_MIGRATIONS=false` + 배포 단계에서 `npx prisma migrate deploy` 한 번, 프록시 뒤면 `TRUST_PROXY=1`. **서버 메모리 1GB 이상**(부하 테스트: 실시간 연결 3,000개에 약 550MB). 실시간 연결(SSE)이 오래 열려 있으므로 호스팅의 요청 타임아웃(최소 몇 분)·연결 유지 제한 확인. 앱 개발/운영 설정 분리는 완료(`app.config.ts`/`eas.json`) |
| 개발용 → 운영 전환(소셜 로그인·푸시) | 2026-10-02 결정: 회사별 앱·채널은 **새로 만들지 않고 지금 것을 그대로 쓰면서 운영 앱 정보만 추가**(같은 앱이면 같은 회원 ID라 테스트 계정이 이어짐, 키도 같음) | 운영 번들 ID `com.toffeechat.app`(법인 후 애플 등록)·안드로이드 운영 패키지·서명 SHA-1/키 해시가 생기면: 구글 — 같은 프로젝트에 iOS·안드로이드 운영 클라이언트 추가, 웹 클라이언트에 운영 웹 주소 추가 / 카카오 — 같은 앱 네이티브 키에 운영 번들 ID·패키지+키 해시, REST 키에 운영 Callback / 네이버 — 같은 앱에 운영 iOS·안드로이드 환경, 운영 Callback / LINE — 같은 채널에 운영 번들 ID·패키지, 운영 Callback / Firebase — 운영 앱 등록 후 설정 파일 / 애플 — 운영 번들 ID로 새로 등록 / 서버 — 운영 Railway(데모와 분리) 변수에 같은 키(시크릿은 새로 발급 권장). `eas.json` production 프로필에 `_PROD` 값 채우기 |
| LINE 로그인 지역 | 2026-10-02 Provider `Toffee` + LINE Login 채널 하나(서비스 지역 **Thailand**, 운영자 나라 South Korea). LINE은 채널마다 서비스 지역을 하나만 고르고 나중에 못 바꿈 | 대만·일본·인도네시아 출시 전에 **같은 Provider**에 지역별 LINE Login 채널을 추가(같은 Provider면 같은 회원 ID라 계정이 이어짐) → 서버 `LINE_CHANNEL_ID`에 쉼표로 추가, 앱은 지역별 채널 ID를 고르는 처리 필요 |
| 구글 클라우드 조직 | 지금은 "조직 없음"(토피 Gmail 소유 프로젝트 `toffee-c6cba` — Firebase·구글 로그인 공용, 2026-10-02) — 1인 팀엔 문제없음 | 법인 설립 후 팀원이 생기면 `toffeechat.app` 도메인으로 무료 Cloud Identity를 만들어 조직을 생성하고 프로젝트를 옮길지 검토(프로젝트 ID·로그인 키는 그대로) |
| 아티스트 연결 링크 주소·예약 오픈(2026-10-20) | 링크는 `웹주소/link/<토큰>` — 운영자가 연 웹 주소를 씀(앱에서 만들면 데모 주소). 예약 오픈은 공개 시각이 되면 자동으로 열림 | 운영 웹 주소가 정해지면 앱 빌드 환경 변수 `EXPO_PUBLIC_WEB_URL`에 넣기. 예약 오픈하는 아티스트·묶음의 스토어 상품은 공개 시각 전에 심사 통과해 두기. 필요하면 서버 `ACTOR_LINK_TTL_DAYS`(링크 유효 일수, 기본 14) |
| 애플 환불 알림 누락 대조(2026-10-22) | 애플 환불은 팬이 애플에 직접 요청 → 애플이 환불하면 서버 알림으로 우리 결제 기록이 "환불"로 바뀜. **알림이 안 오면 환불된 돈이 정산에 그대로 남음** — 팬별로 챙기는 기능(운영자 "환불 처리 대기")은 2026-10-22 사용자 결정으로 안 만듦(운영자가 할 수 있는 일이 없고, 이 누락과 "팬이 요청 안 함"을 구분하지도 못해서) | 출시 전(정산 첫 마감 전): 매달 마감 때 App Store Connect 정산 보고서의 환불 건과 우리 장부를 대조하거나, 애플 "환불 내역 조회(Get Refund History)" API로 안내한 결제를 자동 확인하는 작은 작업 — 어느 쪽으로 할지 그때 결정 |
| 영상 스트리밍 | 당분간 불필요(압축 업로드 + 다운로드 재생) | 영상이 많아지면 Cloudflare Stream 검토 |
| 배포 때 마무리 시간(2026-10-25) | 서버가 SIGTERM을 받으면 처리 중인 보내기·푸시·예약 작업을 끝낼 때까지 최대 25초 기다렸다가 끔(`SHUTDOWN_GRACE_MS`, 코드 완료). **데모 서버 설정 완료(2026-10-25)**: Railway → 서버 서비스 → Settings → Deploy → **Teardown 켜짐, Draining 30초, Overlap 0초**(이전엔 Draining 0초라 업데이트 때 바로 강제 종료됐음. Overlap은 0 — 새·옛 서버가 같이 돌면 예약 작업이 두 번 실행될 수 있음) | 👤 운영 Railway 서버를 만들 때도 같은 값(Teardown 켜기, Draining 30, Overlap 0) |
| 운영 주소(2026-10-21 사용자 확정) | 서버 `api.toffeechat.app`, 소속사·운영자 PC 웹 `app.toffeechat.app` — 앱 `eas.json` production 프로필의 `EXPO_PUBLIC_API_URL`·`EXPO_PUBLIC_WEB_URL`에 넣어 둠 | 운영 Railway·Cloudflare Pages를 만들 때 이 주소로 연결, 서버 `API_PUBLIC_URL`·`WEB_LOGIN_ORIGINS`, 각 로그인 콘솔 돌아올 주소, 랜딩 약관 링크. 순서는 [사업 본부](https://claude.ai/artifact/6WgyADTTudgmSV3tdWvKK6) "운영 전환" 탭 2단계 |
| 운영 기능 설정(2026-10-20) | 코드 완료 — 값만 넣으면 동작 | 👤 운영 서버: `ADMIN_ALERT_EMAIL`(운영자 알림 받을 주소, 저장소에 적지 말 것), 필요하면 `ADMIN_ALERT_KINDS`, `ADMIN_MFA_HOURS`(기본 12). 구글 Play 서비스 계정에 **구독 관리(주문·구독 관리) 권한** — 활동 종료 때 구독 갱신 해지에 필요. 앱 빌드 변수 `EXPO_PUBLIC_IOS_APP_STORE_ID`(앱스토어 등록 후 — 강제 업데이트 화면이 바로 앱 페이지로). 애플 상품 판매 중지가 기존 구독 갱신을 멈추는지 샌드박스로 확인 |

## 배포 자동화 — 내가 직접 할 설정 (2026-10-25)

폰에서 말로 배포하는 체계(`deploy-guide.md`, 기술 `docs/engineering/deploy-runbook.md`)는 코드·워크플로가 끝났고, 아래 값만 넣으면 전부 돈다.
**값(토큰·비밀값)은 저장소·대화에 붙여 넣지 말 것** — 각 서비스 화면에서 GitHub 화면으로 바로 복사. 넣은 뒤 Claude에게 "넣었어"라고만 하면 확인 실행을 한다.
GitHub 값 넣는 곳: 저장소 `toffeechat/toffee` → Settings → Secrets and variables → Actions(저장소 전체) 또는 Settings → Environments → 환경 이름(운영용).

### A. 지금 — 프리뷰(데모)용

| # | 할 일 | 어디서 | 넣을 곳 |
|---|---|---|---|
| 1 | **점검용 비밀값 만들기** — 비밀번호 관리자 생성기로 40자 무작위 | — | 아래 2·3에 같은 값 |
| ✅ 2 | Railway 데모 서버 변수 `SMOKE_TEST_SECRET` | Railway → `toffee-demo` → 서버 서비스 → Variables → 저장(자동 재배포) | 서버 |
| ✅ 3 | GitHub Secret `PREVIEW_SMOKE_TEST_SECRET` | 위 값 그대로 | 저장소 Secrets |
| ✅ 4 | **Expo 토큰** — expo.dev → 조직 `toffeechat-team` → Settings → **Robot users** → 새 로봇(역할 Developer) → Create token(만료 없음 또는 1년) | Expo | 저장소 Secret `EXPO_TOKEN` |
| ✅ 5 | **Sentry 읽기 토큰** — sentry.io → 오른쪽 위 내 이름 → User Auth Tokens → Create(권한 `project:read`·`event:read`만). 운영자 홈 "최근 오류"용 `SENTRY_API_TOKEN`과 같은 걸 써도 됨 | Sentry | 저장소 Secret `SENTRY_AUTH_TOKEN` |
| ✅ 6 | Railway 데모 서버 **Wait for CI** 켜기 — CI(테스트)가 실패한 커밋은 데모에 안 올라가게 | Railway → 서버 서비스 → Settings → Deploy | — |
| ✅ 7 | **폰 GitHub 앱** 설치·로그인 → 설정 → 알림에서 Actions(실패한 실행)·배포 승인 요청 켜기 | App Store | — |
| ✅ 8 | **업타임 모니터**(2026-10-25 완료 — 모니터 3개: 데모 서버 `/health`·DB `/health/ready`·웹, 로그인 계정은 사업화 장부) — UptimeRobot(무료, 5분 간격) 가입 → HTTP 모니터 `https://api-demo.toffeechat.app/health/ready`, `https://demo.toffeechat.app` → 알림: 폰 앱 푸시(UptimeRobot 앱 설치) | UptimeRobot | — |
| ✅ 9 | **Sentry 폰 알림** — (2026-10 새 화면) Issues → Monitors → 아래 "Create an issue alert" → Source "all issues in all projects", 트리거 "A new issue is created" + "A resolved issue regresses", 동작 Notify → Member(Toffee = dev@). "많이 남(escalates)"은 데모에선 안 걸고 운영 때 B12에서, 동작: 이메일(토피 Gmail → 폰 Gmail 앱 알림). Sentry 앱이 있으면 그 푸시도 | Sentry | — |

- **2026-10-25 1~5 완료**: 점검 비밀값(Railway `SMOKE_TEST_SECRET` + GitHub `PREVIEW_SMOKE_TEST_SECRET`, random.org 32자), Expo 로봇 `github-deploy`(조직 `toffeechat-team`, 역할 Developer) 토큰 → `EXPO_TOKEN`, Sentry 개인 토큰(Project·Issue&Event Read) → `SENTRY_AUTH_TOKEN`. 확인 실행: 자동 점검 8개(헬스·DB·로그인·메시지 보내기·받기·답장·웹) 모두 통과, Sentry 새 오류 없음, OTA `a3a762b`(버전업 전 화면 수정)가 robot 이름으로 preview 채널에 나감. 첫 Expo 토큰은 "GraphQL request failed"로 실패 → 다시 만들어 넣으니 됨. 8 업타임 모니터도 같은 날 완료
- **2026-10-27 6·7·9 완료 — A 전부 끝**: Railway `toffee` 서비스 Wait for CI 켜고 Apply(같은 코드로 재시작, `/health` 정상 확인), 폰 GitHub 앱 알림 "배포 검토"·"워크플로 실행" 켬 + 웹 설정 Actions "실패만", Sentry 알림 규칙 하나(모든 프로젝트·새 이슈·재발 → dev@ → Gmail) — 테스트 메일 폰 도착 확인.
- 1~3이 없으면 자동 점검은 헬스·웹만 하고 "로그인·메시지 건너뜀"으로 나옴. 4가 없으면 앱 OTA를 워크플로가 못 해서 PC에서 `npm run ota`를 해야 함. 5가 없으면 "Sentry 확인 안 됨".
- GitHub Actions 시간: 프리뷰 배포 한 번에 약 10~20분(대부분 서버·웹 빌드를 기다리는 시간). 조직 저장소 무료 월 2,000분 — 하루 2~3번이면 충분. 모자라면 지출 한도 확인.
- 계정을 새로 만들면(UptimeRobot·Expo 로봇 등) 사업화 장부에 Claude가 적는다.

### B. 운영 환경을 만들 때 (사업 본부 "운영 전환" 2단계, 12월~)

| # | 할 일 | 넣을 곳(Environment `production`) |
|---|---|---|
| 1 | Railway 운영 프로젝트·서버 서비스 — GitHub 저장소 연결하되 **자동 배포 끄기**(Settings → Source 브랜치 트리거 해제), Root `/backend`, Config `/backend/railway.json` | — |
| 2 | Railway 운영 프로젝트 → Settings → Tokens → **Project token**(production 환경) | Secret `RAILWAY_TOKEN` |
| 3 | 서비스 ID·환경 ID 복사(서비스 화면에서 Ctrl/Cmd+K → "Copy Service ID" / "Copy Environment ID") | Variables `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID` |
| 4 | 운영 점검 비밀값(데모와 **다른** 40자) → Railway 운영 서버 변수 `SMOKE_TEST_SECRET` | Secret `PROD_SMOKE_TEST_SECRET` |
| 5 | Cloudflare → Workers & Pages → Create → Pages → **Upload assets**(Direct Upload)로 프로젝트 `toffee-app` 생성 → 커스텀 도메인 `app.toffeechat.app` | Variable `CLOUDFLARE_PAGES_PROJECT`=`toffee-app` |
| 6 | Cloudflare → My Profile → API Tokens → 템플릿 "Edit Cloudflare Pages"(토피 계정만) / 계정 ID(대시보드 오른쪽) | Secret `CLOUDFLARE_API_TOKEN`, Variable `CLOUDFLARE_ACCOUNT_ID` |
| 7 | **백업 버킷** — R2 비공개 버킷 `toffee-backups` + 이 버킷만 Object Read & Write 토큰, 수명 주기 규칙(90일 뒤 삭제) | Secrets `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` |
| 8 | **백업 암호화 키** — PC에서 `gpg --quick-gen-key "Toffee Backup" rsa4096 encr never` → `gpg --armor --export "Toffee Backup"`(공개키만 GitHub에). 비밀키는 `gpg --armor --export-secret-keys`로 내보내 비밀번호 관리자에 보관 — **잃어버리면 백업을 못 품** | Secret `BACKUP_GPG_PUBLIC_KEY` |
| 9 | 운영 DB 주소(Railway Postgres → Connect → Public URL) | Secret `PROD_DATABASE_URL` (Environment `production-data`에도 같은 값) |
| 10 | 운영 웹 소셜 로그인 공개 키(데모 Pages 변수와 같은 이름, 운영 값) | Variables `EXPO_PUBLIC_WEB_KAKAO_REST_API_KEY`·`_NAVER_CLIENT_ID`·`_LINE_CHANNEL_ID`·`_APPLE_SERVICES_ID`, 스토어 등록 후 `EXPO_PUBLIC_IOS_APP_STORE_ID` |
| 11 | GitHub → Settings → Environments → `production`·`production-data` 만들기 → **Required reviewers = 나**, Deployment branches = `main`만 | — |
| 12 | 업타임 모니터에 `https://api.toffeechat.app/health/ready`·`https://app.toffeechat.app` 추가(UptimeRobot 무료 플랜 상업적 사용 조건 다시 확인 — 장부 메모), Sentry: 기존 규칙(모든 환경 새 이슈·재발)은 두고 운영 전용 규칙 하나 더 — Environment `production`, 트리거 "An issue escalates"(많이 남) | — |
| 12-1 | **Railway 비용 한도**: 운영 워크스페이스는 Usage Limits의 **하드 리밋을 넉넉하게(또는 끄고) 알림만** — 데모처럼 $15 하드 리밋이면 닿는 순간 운영 서버가 꺼짐. 알림은 예상 월 비용의 1.5배·2배 두 단계 | — |
| 13 | 그다음 Claude에게 "운영 배포 처음 돌려 줘" → 런북 12번 체크리스트(되돌리기·백업·데이터 수정 흐름까지 한 번씩) | — |

### C. 1인 운영 보완 (2026-10-27 점검 — 혼자·출장 중 운영 기준으로 빈 곳)

| # | 할 일 | 언제 | 왜 |
|---|---|---|---|
| 1 | **Railway 비용 하드 리밋을 운영엔 걸지 않기**(B 12-1) | 운영 만들 때 | 데모의 $15 하드 리밋을 그대로 쓰면 팬이 늘어 비용이 오르는 날 유료 서비스가 꺼짐 |
| 2 | **폰 분실 대비** — [`phone-loss-plan.md`](./phone-loss-plan.md) 2번 "지금 준비할 것" 7개(Gmail 백업 코드·패스키, 복구 코드 확인, 운영자 2단계 인증 기기 두 대 등) | **지금** | 2단계 인증·승인·알림·Claude가 전부 폰 한 대 — 출장 중 잃으면 손쓸 방법이 없음. 운영자 2단계 인증은 "다른 운영자가 초기화"라 혼자면 못 풂 |
| 3 | **Claude·GitHub 장애 때 폰만으로 비상 조치** — 같은 문서 4번(Railway Redeploy·Cloudflare Rollback·점검 모드) | 운영 전 | 배포 체계가 Claude·GitHub에 기대고 있어서 둘이 장애일 때 서비스 장애가 겹치면 막힘 |
| 4 | **출장 리허설** — 하루 폰(+노트북)만 들고 데모를 일부러 고장 내고 알림 받기 → Claude로 고치기·되돌리기 → C3 비상 조치 → 운영 승인 흐름까지 | 12~1월(운영 만든 뒤) | 런북 12번은 PC 앞 기준 — 실제 출장 조건에서만 보이는 구멍 찾기 |
| 5 | **만료일 달력** — 도메인(2027-10)·애플 멤버십(2027-08)·Expo·Sentry 토큰(만들 때 정한 기간)·결제 카드 유효기간을 사업화 장부 `renews`에 채우고 한 달 전 알림 | 11월 | 만료되면 배포·로그인·결제가 조용히 고장 남 |
| 6 | **무료 한도 확인** — Sentry 월 오류 5천 건, GitHub Actions 월 2천 분, UptimeRobot 무료 플랜 상업적 사용 조건 | 출시 첫 달 | 넘치면 오류 기록이 끊기거나 배포가 멈춤 → 첫 달 사용량 보고 유료 여부 결정 |

- 안 하기로 한 것: 운영과 같은 데이터로 마이그레이션을 미리 시험하는 별도 환경 — 1인 초기 규모엔 과함("추가 먼저" 규칙 + 배포 전 백업으로 충분).

## 검볼 연동 — 토피 쪽 설정 (2026-10-28, 검볼을 데모에 올릴 때)

토피 서버 환경 변수(Railway `toffee-demo`, 나중에 운영) — 비어 있으면 "토피로 로그인"이 꺼져 있음(지금 상태):

| 값 | 내용 |
|---|---|
| `GUMBALL_OAUTH_CLIENT_ID` | 검볼에 주는 이름표(예: `gumball-demo`) — 비밀 아님 |
| `GUMBALL_OAUTH_CLIENT_SECRET` | 무작위 긴 값. **검볼 서버의 `TOFFEE_CLIENT_SECRET`과 같은 값** — 저장소·대화에 적지 말고 두 Railway 화면에만 |
| `GUMBALL_OAUTH_REDIRECT_URIS` | 검볼 웹 주소 + `/auth/toffee`, 검볼 앱 주소(`gumball://auth/toffee`, 개발 앱 `gumball-dev://auth/toffee`) — 쉼표로 |

## 3. 사업·법무

**가입 연령(성인만) 보완 — 결정(2026-09-29)**: 생년월일 자기 신고는 속이면 못 막아서, 비용 없는 것부터 겹겹이:
1. 스토어 등록 때 **연령 등급 18+(애플 17+/18+, 구글 성인)** 로 신청 — 부모가 자녀 폰에 연령 제한을 걸어 두면 설치 자체가 막힘.
2. 약관에 **"생년월일을 허위로 입력하면 이용 제한, 그로 인한 결제는 환불 불가(법이 허용하는 범위)"** 조항 — 변호사 검토 때.
3. **미성년자로 확인되면**(신고·문의) 계정 정지 + 스토어 환불 안내 절차 — 운영 매뉴얼에.
4. 한국 휴대폰 본인인증(PASS 등, 건당 수십~수백 원, 사업자·계약 필요)은 변호사가 필요하다고 하면 법인 설립 후.

| 항목 | 상태 | 미뤄둔 작업 |
|---|---|---|
| 사업자 형태 | 법인(주식회사) 확정 | 11/30 분기점에서 파일럿 의사 1곳 이상이면 12월 설립(`launch-roadmap.md` 5단계) |
| 법인 설립·장부 | **세무사에게 설립부터 기장까지 맡김(2026-10-21 사용자 결정)** — 셀프 설립 대신 | 11월에 2~3곳 상담·견적(설립 대행 포함 여부, 기장료·조정료, 해외 정산 경험) |
| 자본금·지분 | 100만~300만 원, 1주 100원, 지분 100% 대표(2026-10-21 상담 내용, 잠정) — 부족분은 대표 가수금 | 설립 때 확정 |
| 본점 주소 | 미정 — 추천: 직장 다니는 동안은 주소만 쓰는 형태(보육센터 비상주가 되면 그것, 아니면 대전 비상주 사무실), 전업 뒤 입주형 검토. 자택은 주소 공개 문제. 입주형은 보통 심사·보증금·월 입주료+관리비·출근 조건이 있어 공고마다 확인 | 11월에 센터 문의 |
| 회사 이름(법인명) | 미정 — 토피·젤리를 아우르는 별도 이름. **후보 3개(2026-10-21 사용자): 스윗노트(Sweetnote)·디저트랩(Dessert Lab)·단짝**(단짝은 발음·글로벌이 애매). "슈가"(영어권 sugar daddy 연상)·"달콤"(달콤소프트) 피함. 서비스명 토피는 상표로 따로 보호 | 11월 확정, 설립 후 상표 출원 |
| 소속사 정산 비율 | 미확정(6:4+계약금 vs 7:3 논의만) | 협상 |
| 이용약관·개인정보처리방침 | 초안 화면만 있음 | 변호사 검토 후 최종본. 추가할 조항: 대화기록 1년 보존, 스타가 팬 메시지를 인용하면 그 내용이 다른 구독자에게 공개됨(닉네임은 안 보임 — 2026-10-13 변경, 초안 반영함), 스타 콘텐츠 외부 유출 금지(저장은 개인 소장용만), 약관 위반 제재 시 환불 정책(전자상거래법 등과 충돌 여부 확인), 재구독 시 이전 대화 비공개(초안 반영함), 회원 탈퇴 시 파기·보관 범위(결제 기록 보관 기간, 팬 답장 본문 유지 여부) |
| 고객센터 문의 이메일 | **`support@toffeechat.app` 생성(2026-10-01)**, `app/.env.example`에 반영 | EAS 환경변수 `EXPO_PUBLIC_SUPPORT_EMAIL`에도 넣기 — 그 전엔 "문의 창구를 준비 중" 표시. 스토어 등록 시 지원 연락처로도 사용 |
| 인앱결제 상품 | 코드 완료(2026-09-29 — 결제창·서버 확인·묶음·복원·갱신/만료/환불 알림·만료 정리) | 앱스토어/플레이스토어 콘솔에 배우별·커플방별·묶음별 구독 상품 등록 → 운영자 화면(배우 상세·묶음 상품)에 상품 ID 입력(소문자·숫자·_·., 예: `toffee.actor.nawin`, `toffee.bundle.nawin_pakin`). **애플은 배우마다·묶음마다 구독 그룹을 따로** 만들 것(같은 그룹 안에선 하나만 구독 가능해서 여러 배우 동시 구독이 안 됨). 아래 "결제·로그인 키 넣기" 표대로 설정 |
| 결제·로그인 키 넣기(2026-09-29 코드 미리 작성, 넣으면 켜짐) | 코드 완료 | **서버**(`backend/.env.example`에 설명): 애플 결제 `APPLE_BUNDLE_ID`·`APPLE_APP_ID`(숫자)·`APPLE_IAP_ENVIRONMENT`, 구글 결제 `GOOGLE_PLAY_PACKAGE_NAME`·`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, 구글 결제 알림 `GOOGLE_RTDN_AUDIENCE`·`GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL`, 로그인 `GOOGLE_CLIENT_ID`(웹 클라이언트 ID)·`APPLE_CLIENT_ID`(번들 ID, 운영·개발 둘 다 쉼표로)·`LINE_CHANNEL_ID`·`KAKAO_APP_ID`. **스토어 알림 주소**: App Store Connect "App Store 서버 알림 V2" → `<서버 주소>/iap/apple/notifications`(운영·샌드박스 둘 다), Play Console "실시간 개발자 알림" → Pub/Sub 주제 + 푸시 구독(엔드포인트 `<서버 주소>/iap/google/notifications`, 인증 켜기). **앱**(EAS 환경변수, `app/.env.example`): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `_PROD`/`_DEV`로 나눈 구글 iOS 클라이언트 ID·URL scheme, 카카오 네이티브 앱 키, 네이버 키·시크릿·URL scheme, LINE 채널 ID. 웹 구글 로그인은 구글 콘솔 "승인된 JavaScript 원본"에 PC 웹 주소. PC 웹 카카오·네이버·LINE 로그인: 앱과 같은 카카오 앱·네이버 애플리케이션·LINE 채널에 웹 플랫폼과 돌아올 주소(`<웹 주소>/oauth/kakao` 등) 추가 → 서버 `WEB_LOGIN_ORIGINS`·`KAKAO_REST_API_KEY`·`NAVER_CLIENT_ID/SECRET`·`LINE_WEB_CHANNEL_ID/SECRET`, 앱 `EXPO_PUBLIC_WEB_*` 입력. 스타 미발송 환불(2026-09-29): 구글 결제 서비스 계정에 Play Console "주문 관리" 권한 추가(서버가 그 달 결제만 환불), 약관에 환불 기준 문구. PC 웹 애플 로그인(2026-09-29): Apple Developer → Identifiers → **Services ID** 만들기(iOS 앱 ID를 Primary App ID로 묶어야 앱과 같은 계정, Domains·Return URL `<https 웹 주소>/oauth/apple`) + Keys → "Sign in with Apple" 키(.p8, 한 번만 내려받을 수 있으니 보관) → 서버 `APPLE_WEB_SERVICES_ID`·`APPLE_TEAM_ID`·`APPLE_SIGNIN_KEY_ID`·`APPLE_SIGNIN_PRIVATE_KEY`, 앱 `EXPO_PUBLIC_WEB_APPLE_SERVICES_ID`. 넣은 뒤 **실기기 빌드로 로그인·결제(샌드박스 계정) 한 번씩 확인** — 네이티브 SDK라 웹에선 확인 불가 |
| 메시지 번역 엔진 키 | 코드 완료(2026-09-29), **데모 서버에 키 들어가 있음(2026-10-13 시작 로그로 확인)** — 남은 건 월 사용 한도 확인 | Anthropic 콘솔 가입(회사 이메일로) → API 키 발급 → 서버 `ANTHROPIC_API_KEY`. 넣기 전에 `backend/scripts/translation-sample.mjs`로 예문 번역 품질 확인(몇 원 수준 비용). 월 사용 한도(예산) 설정 권장 |
| 태국 소속사 지급 세무 | 미검토 | 세무사 자문 |
| 앱 문구 번역 검수 | 태국어·일본어·중국어(간체/번체) 기계 번역 상태 (2026-09-28) | 출시 전 원어민 검수 — 문구 파일은 `app/src/i18n/locales/`, 푸시 문구는 `backend/src/notifications/push-messages.ts` |

- **구글 로그인 동의 화면 로고**(2026-10-04): 카카오·네이버·LINE은 토피 로고를 올렸지만 구글은 로고를 올리면 OAuth 앱 심사(도메인 소유 확인 등,
  며칠~몇 주)가 시작돼 일부러 비워 둠. 출시 준비(6단계) 때 운영 도메인·개인정보처리방침 최종본과 같이 심사 신청.

## 랜딩 페이지 배포 (2026-10-19 결정 → 같은 날 사용자가 배포 완료: Workers 정적 사이트 `toffee-landing`, toffeechat.app·www 연결)

- `toffeechat.app` 첫 화면이 없어 "연결할 수 없음"이 뜸(사용자 확인) → 소속사가 회사 주소를 검색했을 때 빈 화면이면 신뢰가 떨어져서 **첫 메일 전에** 올린다.
- 페이지는 저장소 `landing/`(빌드 없는 정적 HTML). **Cloudflare Pages 새 프로젝트 `toffee-landing`**(무료) — 지금은 파일 올리기(Direct Upload), main에 들어간 뒤엔 GitHub 연결
  (출력 폴더 `landing`, watch path `landing/*`, 웹 데모 프로젝트엔 Exclude `landing/*`). 도메인 `toffeechat.app`·`www` 연결, 메일 전달(MX)은 영향 없음. 절차 `landing/README.md`.
- 약관·개인정보 링크는 당분간 데모 서버 초안(`api-demo…/legal/…`) — 운영 서버 생기면 바꿈.

