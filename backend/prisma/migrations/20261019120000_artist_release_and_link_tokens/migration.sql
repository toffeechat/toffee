-- 아티스트 공개 예정·예약 오픈(releaseAt, 알림 받기 ReleaseWatch)과 계정 연결 링크(ActorLinkToken), 2026-10-19
-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "releaseAt" TIMESTAMP(3),
ADD COLUMN     "releaseNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN     "releaseAt" TIMESTAMP(3),
ADD COLUMN     "releaseNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReleaseWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "bundleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorLinkToken" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseWatch_actorId_idx" ON "ReleaseWatch"("actorId");

-- CreateIndex
CREATE INDEX "ReleaseWatch_bundleId_idx" ON "ReleaseWatch"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseWatch_userId_actorId_key" ON "ReleaseWatch"("userId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseWatch_userId_bundleId_key" ON "ReleaseWatch"("userId", "bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "ActorLinkToken_tokenHash_key" ON "ActorLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActorLinkToken_actorId_idx" ON "ActorLinkToken"("actorId");

-- AddForeignKey
ALTER TABLE "ReleaseWatch" ADD CONSTRAINT "ReleaseWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWatch" ADD CONSTRAINT "ReleaseWatch_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseWatch" ADD CONSTRAINT "ReleaseWatch_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorLinkToken" ADD CONSTRAINT "ActorLinkToken_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

