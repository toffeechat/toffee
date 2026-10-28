-- 운영자 2단계 인증 코드 실패 잠금·재사용 방지(2026-10-28 점검)
ALTER TABLE "User" ADD COLUMN "totpFailedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totpLockedUntil" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER;
