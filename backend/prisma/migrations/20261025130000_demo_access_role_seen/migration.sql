-- 데모 화면별 접속 요약(2026-10-25) — 알림 메일 30분 규칙을 화면(소속사·아티스트·팬)마다 따로
-- CreateTable
CREATE TABLE "DemoAccessRoleSeen" (
    "codeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DemoAccessRoleSeen_pkey" PRIMARY KEY ("codeId","role")
);

-- AddForeignKey
ALTER TABLE "DemoAccessRoleSeen" ADD CONSTRAINT "DemoAccessRoleSeen_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "DemoAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
