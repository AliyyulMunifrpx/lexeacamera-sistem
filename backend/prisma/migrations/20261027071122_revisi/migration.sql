/*
  Warnings:

  - You are about to drop the column `Terms_and_condition` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "Terms_and_condition",
ADD COLUMN     "terms_and_condition" TEXT;
