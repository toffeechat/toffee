-- 메시지 삭제 기록 보강(2026-10-25) — 운영자가 직접 지운 경우 그 운영자 id, 운영자·소속사 삭제 사유, 지운 메시지 사진·영상 정리용 색인
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedByAdminId" TEXT,
ADD COLUMN     "deletedReason" TEXT;

-- CreateIndex
CREATE INDEX "Message_deletedAt_idx" ON "Message"("deletedAt");
