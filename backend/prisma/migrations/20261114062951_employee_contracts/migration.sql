-- CreateTable
CREATE TABLE "EmployeeContract" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeContract_employee_id_start_date_idx" ON "EmployeeContract" ("employee_id", "start_date");

-- AddForeignKey
ALTER TABLE "EmployeeContract"
ADD CONSTRAINT "EmployeeContract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pindahkan data kontrak lama (HARUS sebelum kolom dihapus)
INSERT INTO "EmployeeContract" ("id", "employee_id", "start_date", "end_date", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id",
       COALESCE("contract_start", LEAST("created_at"::date, "contract_end")),
       "contract_end", NOW(), NOW()
FROM "Employee"
WHERE "contract_start" IS NOT NULL OR "contract_end" IS NOT NULL;

-- AlterTable
ALTER TABLE "Employee"
DROP COLUMN "contract_end",
DROP COLUMN "contract_start";