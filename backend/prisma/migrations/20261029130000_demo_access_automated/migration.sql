-- 데모 접속 자동 검사 거르기(2026-10-29): 자동 검사로 본 접속의 이유, 브라우저 시간대
ALTER TABLE "DemoAccessEvent" ADD COLUMN "automated" TEXT,
ADD COLUMN "timeZone" TEXT;
