-- 실기기 피드백(2026-10-12): 팬 프로필 사진·상태메시지, 역할별 알림 설정, 소속사가 대신 지운 메시지
ALTER TABLE "User" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "statusMessage" TEXT;
ALTER TABLE "User" ADD COLUMN "notifyArtistMessages" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyIdleAlerts" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Message" ADD COLUMN "deletedByStaffId" TEXT;
