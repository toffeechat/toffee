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

**번역 칸(2026-10-19)**: 자동 번역이 기본으로 켜져서, 번역 키 없이 찍으면 말풍선 아래에 개발용 가짜 번역 "[ko] 원문"이 찍힌다.
가짜 번역은 저장되지 않으므로, 화면에 나오는 메시지의 번역문을 `MessageTranslation`(`messageId`, `languageCode`, `translatedText`)에
직접 넣고 서버를 `TRANSLATION_PROVIDER=claude ANTHROPIC_API_KEY=아무값 node dist/main`으로 띄우면 저장된 번역만 쓴다(없는 건 "번역 보기" 버튼).
한국어판은 카라멜 방 아티스트 메시지 4개 + 답장 화면의 메시지 6개를 넣었다. 언어마다 같은 메시지를 그 언어로 넣으면 된다.
제안서 소속사 화면은 대시보드(`console-dashboard`) + 소속사 모니터링 "답장" 탭(`console-replies`, 화면에 보이는 "번역 보기"를 눌러 번역을 펼친 채 찍음).
**받는 사람이 태국 소속사라 한국어판 제안서에도 앱 화면은 모두 `th-TH`로 찍은 것을 쓴다**(2026-10-25 — 팬·아티스트·소속사·표지·데모 안내). 아티스트 `replies`와 `console-replies`는 "번역 보기"를 펼친 채 찍는다. 태국어 화면에서 번역이 보이게 하려면
외국어 답장(영어·일본어·한국어)의 `languageCode = 'th'` 번역을 `MessageTranslation`에 넣는다. 모니터링 탭의 사진 버튼 줄 겹침은 2026-10-19에 고침.
태국어판 캡처 전엔 팬 화면 채팅방의 팬 본인 메시지(시드의 한국어 답장, `sampleFanReplyId`)도 로컬 DB에서만 태국어로 바꾼다
(`update "Message" set body='วันนี้ก็สู้ๆ นะคะ! เป็นกำลังใจให้เสมอ 💜' where body like '오늘도 화이팅%'` + 그 메시지의 `MessageTranslation` 삭제).
