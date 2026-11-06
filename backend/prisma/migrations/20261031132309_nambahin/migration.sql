-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "pin_failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pin_locked_until" TIMESTAMP(3);
