/*
  Warnings:

  - You are about to drop the column `image_url` on the `Camera` table. All the data in the column will be lost.
  - Changed the type of `price` on the `Camera` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `promo` on table `Camera` required. This step will fail if there are existing NULL values in that column.
  - Made the column `best_selling` on table `Camera` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Camera" DROP COLUMN "image_url",
DROP COLUMN "price",
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "inclusions" SET DEFAULT '',
ALTER COLUMN "promo" SET NOT NULL,
ALTER COLUMN "promo" SET DEFAULT false,
ALTER COLUMN "best_selling" SET NOT NULL,
ALTER COLUMN "best_selling" SET DEFAULT false;

-- CreateTable
CREATE TABLE "CameraImage" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CameraImage_camera_id_idx" ON "CameraImage"("camera_id");

-- AddForeignKey
ALTER TABLE "CameraImage" ADD CONSTRAINT "CameraImage_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
