/*
  Warnings:

  - You are about to drop the column `store_id` on the `Banner` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Banner" DROP CONSTRAINT "Banner_store_id_fkey";

-- AlterTable
ALTER TABLE "Banner" DROP COLUMN "store_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
