-- 자동 결제 실패(스토어 유예 기간) 표시(2026-10-28) — 앱의 "결제 수단을 확인해 주세요"

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "billingIssueAt" TIMESTAMP(3);
