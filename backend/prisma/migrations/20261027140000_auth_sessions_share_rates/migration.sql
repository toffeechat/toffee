-- 로그인 세션·토큰 세대(2026-10-27) — 기기별 로그아웃·모든 기기 로그아웃·토큰 자동 연장 / 소속사 배분율 달별 이력 — 창립 파트너 70%→60%를 결제 달 기준으로

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "platform" TEXT,
    "deviceModel" TEXT,
    "appVersion" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyShareRate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "fromMonth" TEXT NOT NULL,
    "percent" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyShareRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyShareRate_agencyId_fromMonth_key" ON "AgencyShareRate"("agencyId", "fromMonth");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyShareRate" ADD CONSTRAINT "AgencyShareRate_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 지금까지의 소속사별 배분율을 "처음부터" 적용되는 이력 한 줄로 옮김(정산 결과는 그대로)
INSERT INTO "AgencyShareRate" ("id", "agencyId", "fromMonth", "percent", "createdAt")
SELECT gen_random_uuid()::text, "id", '2000-01', "revenueSharePercent", CURRENT_TIMESTAMP
FROM "Agency"
WHERE "revenueSharePercent" IS NOT NULL;
