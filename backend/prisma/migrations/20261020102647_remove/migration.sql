-- DropForeignKey
ALTER TABLE "Camera" DROP CONSTRAINT "Camera_category_id_fkey";

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
