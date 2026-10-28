# toffeechat.app 랜딩 페이지

2026-10-19 첫 버전, 2026-10-28 소속사 문구를 "창립 파트너"로·커플방 한 문장 추가. 빌드 없는 정적 페이지 하나(`index.html`) + `assets/`. 태국어·영어·한국어(주소 `?lang=th|en|ko`, 없으면 브라우저 언어,
고르면 기억). 문구는 `docs/product/agency-outreach.md` 한국어 기준본과 같은 내용이고 **태국어는 원어민 검수 전 초안**.

- 앱 화면: `scripts/pitch-screens/capture.cjs`로 찍은 태국어 화면(둘러보기·채팅방·프로필)을 JPG로 줄인 것. 화면이 바뀌면 다시 찍어 교체.
- 약관·개인정보처리방침 링크는 지금 데모 서버(`api-demo.toffeechat.app/legal/…`)의 초안. 운영 서버가 생기면 주소를 바꾼다.
- 연락처: `support@toffeechat.app`, LINE 공식 계정 `@614whagc`(QR = `https://lin.ee/Sc0jE4J`).
- 쿠키·분석 도구 없음(개인정보 수집 없음). 넣게 되면 개인정보처리방침과 동의 배너부터.

## 배포 (Cloudflare Workers 정적 사이트, 무료)

**지금(2026-10-19 공개)**: Cloudflare → Workers & Pages → Create → **Upload your static files**로 올린 Worker `toffee-landing`
(정적 파일만이라 요청 비용 없음). **고칠 때**: `toffee-landing` → Deployments(또는 Overview) → **New deployment** → 이 폴더(`index.html`과
`assets/`가 바로 들어 있는 상태)를 다시 올림.

**자동 배포 준비(2026-10-28)**: `wrangler.jsonc`(Worker 이름 `toffee-landing`, 이 폴더를 정적 파일로)와 `.assetsignore`(README 등은 안 올림)를 넣어 둠
(`wrangler deploy --dry-run` 통과). **사용자가 한 번 할 일**: Cloudflare → Workers & Pages → `toffee-landing` → Settings → **Build** → Connect →
GitHub `toffeechat/toffee`, Branch `main`, **Root directory `landing`**, Build command 비움, Deploy command `npx wrangler deploy`,
Build watch paths Include `landing/*`. 그 뒤로는 main에 `landing/` 변경이 합쳐지면 자동으로 올라감(무료, GitHub Actions 시간 안 씀).

**나중 방법 — GitHub 연결**(main에 이 폴더가 들어간 뒤, 원하면 Worker 설정 Builds에서 연결하거나 Pages로 옮김): Create → Pages → Connect to Git → `toffeechat/toffee` →
Production branch `main`, Framework preset `None`, Build command 비움, Build output directory `landing` →
Settings → Builds → Build watch paths에 Include `landing/*`(다른 폴더 변경으로 빌드되지 않게).
기존 웹 데모 프로젝트(`toffee-demo`)는 Exclude에 `landing/*`를 넣으면 랜딩만 고쳤을 때 데모가 다시 빌드되지 않는다(무료 월 500회 아끼기).

**주소 연결(완료)**: `toffee-landing` → Domains → Add → zone `toffeechat.app` 선택 → 서브도메인 비우고 한 번, `www`로 한 번(Production). 도메인이 이미 Cloudflare에
있어서 DNS는 자동. (Workers 쪽 "Add a site"는 새 도메인 등록 화면이라 누르지 않는다.) 메일 전달(MX 레코드)은 건드리지 않으므로 `support@` 등은 그대로 동작.
