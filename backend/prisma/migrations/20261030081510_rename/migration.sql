/*
  Warnings:

  - You are about to drop the column `modal` on the `Camera` table. All the data in the column will be lost.
  - Added the required column `capital` to the `Camera` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Camera" DROP COLUMN "modal",
ADD COLUMN     "capital" INTEGER NOT NULL;
