-- 소속사별 데모 입장 코드·데모 접속 기록(2026-10-19)
CREATE TABLE "DemoAccessCode" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "note" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoAccessEvent" (
    "id" TEXT NOT NULL,
    "codeId" TEXT,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "newVisit" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoAccessCode_code_key" ON "DemoAccessCode"("code");

CREATE INDEX "DemoAccessEvent_codeId_createdAt_idx" ON "DemoAccessEvent"("codeId", "createdAt");

CREATE INDEX "DemoAccessEvent_createdAt_idx" ON "DemoAccessEvent"("createdAt");

ALTER TABLE "DemoAccessEvent" ADD CONSTRAINT "DemoAccessEvent_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "DemoAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
