-- 디저트랩 다른 서비스(검볼) 토피 계정 연결(2026-10-28) — 표 추가만
-- CreateTable
CREATE TABLE "PartnerLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeChallenge" TEXT,
    "codeRedirectUri" TEXT,

    CONSTRAINT "PartnerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLink_sub_key" ON "PartnerLink"("sub");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLink_codeHash_key" ON "PartnerLink"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLink_userId_partner_key" ON "PartnerLink"("userId", "partner");

-- AddForeignKey
ALTER TABLE "PartnerLink" ADD CONSTRAINT "PartnerLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

