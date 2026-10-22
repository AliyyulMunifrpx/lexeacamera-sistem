/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Marketplace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Marketplace" ALTER COLUMN "is_active" SET DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Marketplace_name_key" ON "Marketplace"("name");
