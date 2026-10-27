-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "Terms_and_condition" TEXT;

-- CreateTable
CREATE TABLE "Termsandcondition" (
    "id" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "Termsandcondition_pkey" PRIMARY KEY ("id")
);
