# 제안서용 앱 화면 캡처

소속사 제안서(`docs/product/agency-outreach.md`)에 넣는 실제 앱 화면을 다시 찍는 도구(2026-10-13). 화면이 바뀌면 다시 찍어
제안서 아티팩트에 올린다. **로컬 DB만** 바꾼다 — 데모 서버(Railway)나 코드는 건드리지 않는다.

1. 로컬 Postgres + `backend/.env`(`.env.example` 복사, `DEMO_ASSET_BASE_URL="http://localhost:8081/demo"` 추가)
   → `npx prisma migrate deploy` → `npx prisma db seed` → `npx nest build && node dist/main`
2. `app/`에서 `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081`
3. 시드 직후 DB를 `pg_dump -Fc toffee > seed.dump`로 저장
4. 언어마다: `pg_restore --clean --if-exists -d toffee seed.dump` → 가상 팬 4명 만들기
   (`POST /auth/dev-login` `fan3`~`fan6@toffee.demo`) 
   → 답장을 붙일 메시지 id를 찾아(`P=$(psql -At -c "select \"replyToMessageId\" from \"Message\" where body like 'มาเลยค่ะ!%'")`)
   `psql -v parent=$P -f loc-<언어>.sql` → `REPLY_ID=$P node capture.cjs <출력 폴더> <th-TH|ko-KR|en-US>`
   (Chromium 경로가 다르면 `CHROMIUM_PATH`)

`loc-*.sql`은 가상 아티스트·소속사·팬 이름과 메시지를 그 언어로 바꾸고, 아티스트 화면 "팬 답장"이 비어 보이지 않게 가상 팬 답장 4개를
넣는다. 캡처는 폰 화면(390×844, 2배)과 소속사 PC 화면(1440×900, 2배).
