-- 첫 답장 전 메시지 이용 규칙 동의 시각(2026-10-12)
ALTER TABLE "User" ADD COLUMN "replyRulesAcceptedAt" TIMESTAMP(3);
