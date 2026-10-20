-- 운영 기능 묶음(2026-10-20): 애플 판매 중지 표시·계약 종료일(Actor/Bundle), 공지 푸시 시각, 앱 설정(점검·최소 버전), 1:1 문의, 운영자 권한 단계·2단계 인증
-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('OWNER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "contractAlertedAt" TIMESTAMP(3),
ADD COLUMN     "contractEndAt" TIMESTAMP(3),
ADD COLUMN     "storeSaleStoppedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN     "storeSaleStoppedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "pushedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminLevel" "AdminLevel",
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpPendingSecret" TEXT,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "maintenanceOn" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "maintenanceUntil" TIMESTAMP(3),
    "minVersionIos" TEXT,
    "minVersionAndroid" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportInquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportInquiry_status_updatedAt_idx" ON "SupportInquiry"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_userId_updatedAt_idx" ON "SupportInquiry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportMessage_inquiryId_createdAt_idx" ON "SupportMessage"("inquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportInquiry" ADD CONSTRAINT "SupportInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "SupportInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

