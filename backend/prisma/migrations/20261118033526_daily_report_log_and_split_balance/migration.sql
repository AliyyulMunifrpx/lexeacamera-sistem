-- CreateEnum
CREATE TYPE "EntryMethod" AS ENUM ('CASH', 'NON_CASH');

CREATE TYPE "RemitType" AS ENUM ('CASH', 'TRANSFER');

-- DropForeignKey
ALTER TABLE "DailyReport"
DROP CONSTRAINT "DailyReport_cashier_id_fkey";

-- DropIndex
DROP INDEX "DailyReport_cashier_id_date_idx";

DROP INDEX "DailyReport_date_cashier_id_key";

-- AlterTable: DailyReport (kolom wajib dibuat nullable dulu)
ALTER TABLE "DailyReport"
ADD COLUMN "opening_cash" INTEGER,
ADD COLUMN "opening_noncash" INTEGER,
ADD COLUMN "remit_cash" INTEGER,
ADD COLUMN "remit_transfer" INTEGER,
ADD COLUMN "remitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "remitted_at" TIMESTAMP(3),
ADD COLUMN "userId" TEXT;

-- Pindahkan data lama: saldo awal lama dianggap tunai
UPDATE "DailyReport"
SET
    "opening_cash" = "opening_balance",
    "opening_noncash" = 0;

ALTER TABLE "DailyReport"
ALTER COLUMN "opening_cash"
SET
    NOT NULL,
ALTER COLUMN "opening_noncash"
SET
    NOT NULL;

ALTER TABLE "DailyReport"
DROP COLUMN "cashier_id",
DROP COLUMN "cashier_name",
DROP COLUMN "opening_balance",
DROP COLUMN "transferred",
DROP COLUMN "transferred_at";

-- AlterTable: DailyReportEntry (semua baris lama dianggap tunai)
ALTER TABLE "DailyReportEntry" ADD COLUMN "method" "EntryMethod";

UPDATE "DailyReportEntry" SET "method" = 'CASH';

ALTER TABLE "DailyReportEntry" ALTER COLUMN "method" SET NOT NULL;

-- CreateTable
CREATE TABLE "DailyReportLog" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "report_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyReportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReportLog_report_id_seq_idx" ON "DailyReportLog" ("report_id", "seq");

CREATE UNIQUE INDEX "DailyReport_date_key" ON "DailyReport" ("date");

-- AddForeignKey
ALTER TABLE "DailyReport"
ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyReportLog"
ADD CONSTRAINT "DailyReportLog_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- CHECK constraints (manual, tidak bisa dibuat Prisma)
-- DROP IF EXISTS dulu karena migrasi lama sudah membuat sebagian dengan nama yang sama
ALTER TABLE "DailyReport"
DROP CONSTRAINT IF EXISTS "DailyReport_opening_cash_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_opening_noncash_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_proof_size_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_remit_cash_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_remit_transfer_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_remitted_chk",
DROP CONSTRAINT IF EXISTS "DailyReport_remit_proof_chk";

ALTER TABLE "DailyReport"
ADD CONSTRAINT "DailyReport_opening_cash_chk" CHECK ("opening_cash" >= 0),
ADD CONSTRAINT "DailyReport_opening_noncash_chk" CHECK ("opening_noncash" >= 0),
ADD CONSTRAINT "DailyReport_proof_size_chk" CHECK (
    "proof_size" IS NULL
    OR "proof_size" >= 0
),
ADD CONSTRAINT "DailyReport_remit_cash_chk" CHECK (
    "remit_cash" IS NULL
    OR "remit_cash" >= 0
),
ADD CONSTRAINT "DailyReport_remit_transfer_chk" CHECK (
    "remit_transfer" IS NULL
    OR "remit_transfer" >= 0
),
ADD CONSTRAINT "DailyReport_remitted_chk" CHECK (
    NOT "remitted"
    OR (
        "remit_cash" IS NOT NULL
        AND "remit_transfer" IS NOT NULL
    )
),
ADD CONSTRAINT "DailyReport_remit_proof_chk" CHECK (
    NOT "remitted"
    OR "remit_transfer" = 0
    OR "proof_path" IS NOT NULL
);

ALTER TABLE "DailyReportEntry"
DROP CONSTRAINT IF EXISTS "DailyReportEntry_amount_chk";

ALTER TABLE "DailyReportEntry"
ADD CONSTRAINT "DailyReportEntry_amount_chk" CHECK (
    "income" >= 0
    AND "expense" >= 0
    AND (
        ("income" > 0) <> ("expense" > 0)
    )
);