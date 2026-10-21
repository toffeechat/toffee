-- 활동 종료 예정 알림 시각(2026-10-21, B안) — 알림 뒤 결제는 활동 종료 환불 대상 아님
ALTER TABLE "Actor" ADD COLUMN "retireNoticedAt" TIMESTAMP(3);
