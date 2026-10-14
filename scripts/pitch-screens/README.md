# 제안서용 앱 화면 캡처

소속사 제안서(`docs/product/agency-outreach.md`)에 넣는 실제 앱 화면을 다시 찍는 도구(2026-10-13). 화면이 바뀌면 다시 찍어
제안서 아티팩트에 올린다. 로컬에서 서버·웹을 띄워 찍는다 — 데모 서버(Railway)는 건드리지 않는다.

1. 로컬 Postgres + `backend/.env`(`.env.example` 복사, `DEMO_ASSET_BASE_URL="http://localhost:8081/demo"` 추가)
   → `npx prisma migrate deploy` → `npx prisma db seed` → `npx nest build && node dist/main`
2. `app/`에서 `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`
3. 답장을 붙인 메시지 id를 찾아(`P=$(psql -At -c "select \"replyToMessageId\" from \"Message\" where body like 'มาเลยค่ะ!%'")`)
   `REPLY_ID=$P node capture.cjs <출력 폴더> <th-TH|ko-KR|en-US>` (Chromium 경로가 다르면 `CHROMIUM_PATH`)

2026-10-14부터 데모 시드 자체가 태국 소속사 기준(아티스트·소속사 이름 영어, 아티스트 메시지 태국어, 팬 답장 여러 언어, 팬 6명)이라
예전처럼 언어별로 DB를 바꾸는 SQL(`loc-*.sql`)은 없앴다. 화면 글자만 `locale`로 바뀐다. 캡처는 폰 화면(390×844, 2배)과 소속사 PC 화면(1440×900, 2배).
