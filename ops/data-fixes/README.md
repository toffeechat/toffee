# 운영 DB 데이터 수정 기록

운영 DB의 데이터를 직접 고치는 건 **원칙적으로 금지**다(2026-10-25 배포 규칙 4, `docs/engineering/deploy-runbook.md` 9번).
회원 정지·환불·역할 변경·아티스트 활동 종료 같은 건 운영자 화면 기능으로 한다. 화면에 없는 일회성 수정이 꼭 필요할 때만:

1. 이 폴더에 `YYYYMMDD-설명.sql`(예: `20270215-fix-orphan-charges.sql`)을 만들고 맨 위 주석에 **무엇을 왜** 바꾸는지 적는다.
   `UPDATE`·`DELETE`·`INSERT`만 — 트랜잭션 제어(`BEGIN`/`COMMIT`)·구조 변경(`ALTER`/`DROP`/`CREATE`)은 넣지 않는다(구조는 마이그레이션).
2. main에 올린 뒤 GitHub Actions **Production data fix** 실행(`sql_file`, 예상 줄 수 `expected_rows`, 이유).
3. 승인 1(`production`) → 백업 + 미리보기(실행 후 되돌림, 바뀌는 줄 수 표시). 예상과 다르면 멈춤.
4. 승인 2(`production-data`) → 실제 실행. 그사이 줄 수가 바뀌었으면 멈춤.

같은 일이 두 번 생기면 운영자 화면 기능으로 만든다(STATUS.md 아이디어 보관함에 먼저).
