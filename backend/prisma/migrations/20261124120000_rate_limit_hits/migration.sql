-- 요청 횟수 제한 기록을 DB에(2026-11-24 점검 5차): 예전엔 서버 메모리에만 있어서 서버가 N대면 번역·업로드 한도도 N배가 됐음.
-- key = 제한 종류·요청한 사람·경로를 합친 해시(@nestjs/throttler가 만듦), 짧게 살다 지워지는 기록
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitHit_expiresAt_idx" ON "RateLimitHit"("expiresAt");
