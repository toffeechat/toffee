-- 운영자 오류 알림(Sentry) 보낸 기록(2026-10-25) — 같은 알림이 두 번 가지 않게
-- CreateTable
CREATE TABLE "ErrorAlertSent" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorAlertSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorAlertSent_createdAt_idx" ON "ErrorAlertSent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorAlertSent_issueId_kind_bucket_key" ON "ErrorAlertSent"("issueId", "kind", "bucket");
