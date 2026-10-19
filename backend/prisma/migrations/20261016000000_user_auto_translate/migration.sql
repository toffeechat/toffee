-- 메시지 자동 번역(2026-10-16): 기본 켜짐, 설정 > 언어에서 끔
ALTER TABLE "User" ADD COLUMN "autoTranslate" BOOLEAN NOT NULL DEFAULT true;
