# 오류·서버 상태 감시 설정 안내 (비개발자용)

2026-10-25 작성. 운영자 화면에서 오류를 바로 보고, 문제가 생기면 메일·푸시로 알림을 받기 위한 설정 방법이다.
코드는 다 만들어져 있고, 아래 값(키)만 서버에 넣으면 동작한다. **키 값 자체는 이 저장소·문서에 절대 적지 말 것**(서버 설정 화면에만).

## 전체 그림

| 무엇 | 하는 일 | 필요한 것 | 상태 |
|---|---|---|---|
| ① 서버 오류 수집 | 서버에서 난 오류를 Sentry로 보냄 | 서버 변수 `SENTRY_DSN` | 👤 아직(앱은 이미 보냄) |
| ② 운영자 홈 "최근 오류" | Sentry에 모인 오류(앱·서버)를 운영자 홈에서 봄 | 서버 변수 `SENTRY_API_TOKEN` | 👤 아직 |
| ③ 오류 알림(토피) | 새 오류·1시간에 많이 나는 오류를 운영자 알림(메일·푸시)으로 | ②가 되면 자동. 메일은 `ADMIN_ALERT_EMAIL` | ②를 넣으면 바로 |
| ④ 오류 알림(Sentry 자체) | Sentry가 직접 메일을 보냄 — 토피 서버가 꺼져 있어도 옴 | Sentry 화면에서 규칙 설정 | 👤 권장 |
| ⑤ 가동 감시 | 서버가 아예 죽었는지 밖에서 5분마다 확인 | UptimeRobot 같은 외부 서비스 | 👤 권장 |

③은 토피 서버가 Sentry에 물어보는 방식이라 **서버가 죽으면 알림도 못 보낸다**. 그래서 ④·⑤를 같이 해 두는 게 안전하다.

## ① 서버 오류 수집 — `SENTRY_DSN`

1. sentry.io에 토피 전용 계정으로 로그인 → 프로젝트 **toffee-backend** → Settings → **Client Keys (DSN)**.
2. DSN 주소(`https://...ingest.sentry.io/...`)를 복사.
3. Railway → 서버 서비스 → Variables에 `SENTRY_DSN` = 복사한 값.
4. 데모 서버라면 `SENTRY_ENVIRONMENT` = `demo`도 넣기(운영 서버 오류와 섞이지 않게). 운영 서버는 `production`.
5. 다시 배포되면 끝. 서버 시작 로그에 "오류 수집(Sentry)" 경고가 없어지면 성공.

## ② 운영자 홈 "최근 오류" — `SENTRY_API_TOKEN`

토피 서버가 Sentry에 "해결 안 된 오류 목록"을 물어볼 때 쓰는 열쇠다. 읽기 권한만 준다.

1. sentry.io → 왼쪽 아래 내 프로필 → **User Settings → Personal Tokens**(이름이 "User Auth Tokens"일 수 있음) → **Create New Token**.
   - 조직 토큰(Organization Tokens)은 앱 빌드용이라 오류 목록을 못 읽는다 — 꼭 **개인 토큰**.
2. 권한(Scopes)은 읽기 세 개만: **Project: Read**, **Issue & Event: Read**, **Organization: Read**. 나머지는 "No Access".
3. 이름은 예: `toffee-server-read`. 만든 토큰을 복사(다시 안 보여 줌).
4. Railway 서버 변수:
   - `SENTRY_API_TOKEN` = 복사한 토큰
   - (보통은 비워 둠) `SENTRY_ORG`(기본 `toffeechat`), `SENTRY_PROJECTS`(기본 `toffee-backend,toffee-app`)
   - 조직이 **유럽 지역**이면 `SENTRY_API_URL` = `https://de.sentry.io`. 확인: Sentry → Settings → Organization → General → Data Storage Location.
   - 데모 서버 오류만 / 운영 서버 오류만 보려면 `SENTRY_ISSUES_ENVIRONMENT` = `demo` 또는 `production`(비우면 전부).
5. 다시 배포 후 운영자 홈 → "최근 오류" 카드에 목록이 보이면 성공. "가져오지 못했어요(… 401)"이면 토큰·권한, "404"이면 조직·프로젝트 이름이나 지역(`SENTRY_API_URL`)을 확인.

화면에서 보이는 것: 오류 제목, 어디서 났는지, 전체 횟수·최근 24시간 횟수·영향 받은 사용자 수·마지막 발생. 누르면 Sentry 상세 화면이 열린다(Sentry 로그인 필요). 5분마다 새로 가져온다.

## ③ 토피 오류 알림 — 기존 운영자 알림에 "오류" 종류 추가

②를 넣으면 서버가 5분마다 확인해서 운영자 알림(신고·환불 알림과 같은 곳)으로 보낸다.

- **새 오류**: 처음 생긴 오류는 횟수와 상관없이 한 번.
- **많이 나는 오류**: 한 오류가 1시간 안에 **30번 이상**이면 그 시간대에 한 번. 기준은 `ERROR_ALERT_HOURLY_THRESHOLD`로 바꿈(0이면 이 알림은 끔).
- 한 번에 4건 이상이면 한 통으로 묶어서 보냄(배포 직후 오류가 쏟아질 때 알림 폭탄 방지).
- 푸시는 운영자 계정 전원, 메일은 `ADMIN_ALERT_EMAIL`에 넣은 주소. 오류 알림만 끄고 싶으면 `ADMIN_ALERT_KINDS`에서 `ERROR`를 빼고 나머지 종류만 적는다.

## ④ Sentry 자체 메일 알림 (권장)

1. Sentry → **Alerts → Create Alert → Issues**.
2. 프로젝트 toffee-backend(앱도 하나 더 만들어 toffee-app).
3. 조건: "A new issue is created"(새 오류) — 하나 더 만들어 "The issue is seen more than **100** times in **1 hour**"(많이 남) 정도.
4. 동작: "Send a notification to **Member**: 내 계정"(메일).
5. 운영 서버가 생기면 Environment를 `production`으로 좁혀 데모 오류 알림은 안 오게.

## ⑤ 가동 감시 (권장)

서버가 꺼지면 오류 자체가 안 쌓이므로, 밖에서 주기적으로 문을 두드려 보는 서비스가 따로 필요하다.

- 추천: **UptimeRobot** 무료(5분 간격, 모니터 50개). 토피 전용 이메일로 가입 → 사업화 장부에 추가.
- 감시할 주소(HTTP(s) 모니터):
  - 서버 살아 있는지: `https://api-demo.toffeechat.app/health`
  - DB까지 정상인지: `https://api-demo.toffeechat.app/health/ready`
  - 웹 데모 화면: `https://demo.toffeechat.app`
  - 운영 서버가 생기면 그 주소도 똑같이.
- 알림: 내 메일(원하면 휴대폰 앱 푸시). "Down" 알림이 오면 Railway → 서버 → Deployments/Logs부터 본다.
- Sentry에도 "Uptime Monitor" 기능이 있으니(요금제에 따라 개수 제한) 한 곳으로 모으고 싶으면 그걸 써도 된다.
