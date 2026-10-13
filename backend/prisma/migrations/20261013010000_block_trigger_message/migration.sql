-- 소속사 "기록" 화면(2026-10-13): 채널 차단의 계기가 된 팬 답장
ALTER TABLE "ActorFanBlock" ADD COLUMN "messageId" TEXT;

ALTER TABLE "ActorFanBlock" ADD CONSTRAINT "ActorFanBlock_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
