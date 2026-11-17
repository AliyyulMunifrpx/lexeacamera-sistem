-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "cashier_name" TEXT NOT NULL,
    "opening_balance" INTEGER NOT NULL,
    "transferred" BOOLEAN NOT NULL DEFAULT false,
    "transferred_at" TIMESTAMP(3),
    "proof_path" TEXT,
    "proof_content_type" TEXT,
    "proof_size" INTEGER,
    "proof_uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DailyReport_opening_balance_chk" CHECK ("opening_balance" >= 0),
    CONSTRAINT "DailyReport_proof_size_chk" CHECK (
        "proof_size" IS NULL
        OR "proof_size" >= 0
    )
);

-- CreateTable
CREATE TABLE "DailyReportEntry" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "report_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "income" INTEGER NOT NULL DEFAULT 0,
    "expense" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyReportEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DailyReportEntry_amount_chk" CHECK (
        "income" >= 0
        AND "expense" >= 0
        AND (
            ("income" > 0) <> ("expense" > 0)
        )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_proof_path_key" ON "DailyReport" ("proof_path");

-- CreateIndex
CREATE INDEX "DailyReport_cashier_id_date_idx" ON "DailyReport" ("cashier_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_date_cashier_id_key" ON "DailyReport" ("date", "cashier_id");

-- CreateIndex
CREATE INDEX "DailyReportEntry_report_id_seq_idx" ON "DailyReportEntry" ("report_id", "seq");

-- AddForeignKey
ALTER TABLE "DailyReport"
ADD CONSTRAINT "DailyReport_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportEntry"
ADD CONSTRAINT "DailyReportEntry_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE;