-- 메시지 중복 방지 키(2026-10-25) — 응답이 끊겨 앱이 다시 보내도 한 번만 저장. 같은 방 안에서 키가 겹치면 안 됨(NULL은 여러 개 가능)
ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_actorId_clientMessageId_key" ON "Message"("actorId", "clientMessageId");
