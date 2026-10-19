# toffeechat.app 랜딩 페이지

2026-10-19 첫 버전. 빌드 없는 정적 페이지 하나(`index.html`) + `assets/`. 태국어·영어·한국어(주소 `?lang=th|en|ko`, 없으면 브라우저 언어,
고르면 기억). 문구는 `docs/product/agency-outreach.md` 한국어 기준본과 같은 내용이고 **태국어는 원어민 검수 전 초안**.

- 앱 화면: `scripts/pitch-screens/capture.cjs`로 찍은 태국어 화면(둘러보기·채팅방·프로필)을 JPG로 줄인 것. 화면이 바뀌면 다시 찍어 교체.
- 약관·개인정보처리방침 링크는 지금 데모 서버(`api-demo.toffeechat.app/legal/…`)의 초안. 운영 서버가 생기면 주소를 바꾼다.
- 연락처: `support@toffeechat.app`, LINE 공식 계정 `@614whagc`(QR = `https://lin.ee/Sc0jE4J`).
- 쿠키·분석 도구 없음(개인정보 수집 없음). 넣게 되면 개인정보처리방침과 동의 배너부터.

## 배포 (Cloudflare Pages, 무료)

**빠른 방법 — 파일 올리기(Direct Upload)**: Cloudflare → Workers & Pages → Create → Pages → **Upload assets** → 프로젝트 이름
`toffee-landing` → 이 폴더(`index.html`과 `assets/`가 바로 들어 있는 상태)를 끌어다 놓기 → Deploy. 고칠 때마다 다시 올려야 함.

**나중 방법 — GitHub 연결**(main에 이 폴더가 들어간 뒤): Create → Pages → Connect to Git → `toffeechat/toffee` →
Production branch `main`, Framework preset `None`, Build command 비움, Build output directory `landing` →
Settings → Builds → Build watch paths에 Include `landing/*`(다른 폴더 변경으로 빌드되지 않게).
기존 웹 데모 프로젝트(`toffee-demo`)는 Exclude에 `landing/*`를 넣으면 랜딩만 고쳤을 때 데모가 다시 빌드되지 않는다(무료 월 500회 아끼기).

**주소 연결**: `toffee-landing` → Custom domains → `toffeechat.app` 추가 → `www.toffeechat.app`도 추가. 도메인이 이미 Cloudflare에
있어서 DNS는 자동. 메일 전달(MX 레코드)은 건드리지 않으므로 `support@` 등은 그대로 동작.
