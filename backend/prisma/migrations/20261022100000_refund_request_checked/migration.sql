-- AlterTable
ALTER TABLE "RefundRequest" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "checkedById" TEXT,
ADD COLUMN     "checkedNote" TEXT;
