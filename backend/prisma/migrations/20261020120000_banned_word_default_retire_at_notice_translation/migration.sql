-- 금칙어 기본 목록 표시(isDefault), 아티스트 활동 종료 예정(retireAt), 공지 번역 저장(NoticeTranslation), 2026-10-20
-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "retireAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BannedWord" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NoticeTranslation" (
    "noticeId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeTranslation_pkey" PRIMARY KEY ("noticeId","language")
);

-- AddForeignKey
ALTER TABLE "NoticeTranslation" ADD CONSTRAINT "NoticeTranslation_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
