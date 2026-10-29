-- 장기 구독 혜택(2026-10-29): 끊기지 않고 이어서 구독한 기간의 시작. 기존 방 이용권은 구독 시작일로 채움
ALTER TABLE "Subscription" ADD COLUMN "streakStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Subscription" SET "streakStartedAt" = "startedAt";
