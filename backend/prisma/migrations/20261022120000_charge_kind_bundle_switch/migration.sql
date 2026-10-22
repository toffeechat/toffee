-- 같은 CP 묶음 갈아타기(2026-10-22) — 결제 기록 종류(실제 결제 / 남은 기간 차감 / 새 묶음으로 이월)와 가리키는 예전 결제
-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('PAYMENT', 'SWITCH_CREDIT', 'SWITCH_CARRY');

-- AlterTable
ALTER TABLE "PurchaseCharge" ADD COLUMN     "kind" "ChargeKind" NOT NULL DEFAULT 'PAYMENT',
ADD COLUMN     "switchOfChargeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCharge_switchOfChargeId_kind_key" ON "PurchaseCharge"("switchOfChargeId", "kind");

