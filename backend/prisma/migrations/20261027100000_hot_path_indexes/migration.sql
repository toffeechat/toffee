-- 자주 쓰는 조회의 전체 훑기 방지(2026-10-27) — 방 구독자 목록, 팬 한 명의 메시지, 신고한 사람·처리 상태별 신고 목록

-- CreateIndex
CREATE INDEX "Subscription_actorId_cancelledAt_idx" ON "Subscription"("actorId", "cancelledAt");

-- CreateIndex
CREATE INDEX "Message_fanUserId_createdAt_idx" ON "Message"("fanUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedById_idx" ON "Report"("reportedById");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");
