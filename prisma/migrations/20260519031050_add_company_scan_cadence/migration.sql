-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobSource" ADD VALUE 'aggregator_german_us';
ALTER TYPE "JobSource" ADD VALUE 'aggregator_indeed_de';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "fundingStage" TEXT,
ADD COLUMN     "scanIntervalDays" INTEGER NOT NULL DEFAULT 1;
