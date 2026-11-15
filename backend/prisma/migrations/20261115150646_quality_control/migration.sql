-- CreateEnum
CREATE TYPE "QcSection" AS ENUM ('PHYSICAL', 'FUNCTION', 'ACCESSORY', 'COMPLETENESS');

-- CreateEnum
CREATE TYPE "QcClass" AS ENUM ('NORMAL', 'MINOR');

-- CreateEnum
CREATE TYPE "QcOrigin" AS ENUM ('ORIGINAL', 'OEM');

-- CreateEnum
CREATE TYPE "QcType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('DEAL', 'CANCEL');

-- CreateEnum
CREATE TYPE "QcMediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "QcItem" (
    "id" TEXT NOT NULL,
    "section" "QcSection" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityControl" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "QcType" NOT NULL,
    "status" "QcStatus" NOT NULL,
    "product_name" TEXT NOT NULL,
    "serial_number" TEXT,
    "sender_name" TEXT,
    "tracking_number" TEXT,
    "pic" TEXT,
    "price" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QualityControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityControlEntry" (
    "id" TEXT NOT NULL,
    "qc_id" TEXT NOT NULL,
    "item_id" TEXT,
    "section" "QcSection" NOT NULL,
    "name" TEXT NOT NULL,
    "checked" BOOLEAN,
    "classification" "QcClass",
    "origin" "QcOrigin",
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QualityControlEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityControlExtra" (
    "id" TEXT NOT NULL,
    "qc_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QualityControlExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityControlMedia" (
    "id" TEXT NOT NULL,
    "qc_id" TEXT NOT NULL,
    "kind" "QcMediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualityControlMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QcItem_section_sort_order_idx" ON "QcItem" ("section", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "QcItem_section_name_key" ON "QcItem" ("section", "name");

-- CreateIndex
CREATE INDEX "QualityControl_date_idx" ON "QualityControl" ("date");

-- CreateIndex
CREATE INDEX "QualityControl_status_idx" ON "QualityControl" ("status");

-- CreateIndex
CREATE INDEX "QualityControlEntry_qc_id_sort_order_idx" ON "QualityControlEntry" ("qc_id", "sort_order");

-- CreateIndex
CREATE INDEX "QualityControlEntry_item_id_idx" ON "QualityControlEntry" ("item_id");

-- CreateIndex
CREATE INDEX "QualityControlExtra_qc_id_sort_order_idx" ON "QualityControlExtra" ("qc_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "QualityControlMedia_path_key" ON "QualityControlMedia" ("path");

-- CreateIndex
CREATE INDEX "QualityControlMedia_qc_id_idx" ON "QualityControlMedia" ("qc_id");

-- AddForeignKey
ALTER TABLE "QualityControlEntry"
ADD CONSTRAINT "QualityControlEntry_qc_id_fkey" FOREIGN KEY ("qc_id") REFERENCES "QualityControl" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityControlEntry"
ADD CONSTRAINT "QualityControlEntry_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "QcItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityControlExtra"
ADD CONSTRAINT "QualityControlExtra_qc_id_fkey" FOREIGN KEY ("qc_id") REFERENCES "QualityControl" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityControlMedia"
ADD CONSTRAINT "QualityControlMedia_qc_id_fkey" FOREIGN KEY ("qc_id") REFERENCES "QualityControl" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Harga tidak boleh negatif
ALTER TABLE "QualityControl"
ADD CONSTRAINT "QualityControl_price_chk" CHECK (
    "price" IS NULL
    OR "price" >= 0
);

-- Item checklist bawaan (bisa diubah owner lewat endpoint)
INSERT INTO "QcItem" ("id", "section", "name", "sort_order", "updated_at") VALUES
  (gen_random_uuid()::text, 'PHYSICAL', 'Paintloss', 1, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Dent', 2, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Lecet', 3, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Tulisan', 4, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Karet', 5, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Retak / patah', 6, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Jamur', 7, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Debu', 8, NOW()),
  (gen_random_uuid()::text, 'PHYSICAL', 'Dll.', 9, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Shutter & blade', 1, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Flash', 2, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Tombol', 3, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Scroll / dial', 4, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Hotshoe', 5, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'LCD', 6, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Layar', 7, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Speaker', 8, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Viewfinder', 9, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Sensor detection', 10, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Video', 11, NOW()),
  (gen_random_uuid()::text, 'FUNCTION', 'Zoom lens', 12, NOW()),
  (gen_random_uuid()::text, 'ACCESSORY', 'Port charger', 1, NOW()),
  (gen_random_uuid()::text, 'ACCESSORY', 'Tempat baterai', 2, NOW()),
  (gen_random_uuid()::text, 'ACCESSORY', 'Baterai', 3, NOW()),
  (gen_random_uuid()::text, 'ACCESSORY', 'Charger', 4, NOW()),
  (gen_random_uuid()::text, 'COMPLETENESS', 'Charger', 1, NOW()),
  (gen_random_uuid()::text, 'COMPLETENESS', 'Baterai', 2, NOW()),
  (gen_random_uuid()::text, 'COMPLETENESS', 'Tali strap', 3, NOW()),
  (gen_random_uuid()::text, 'COMPLETENESS', 'Box', 4, NOW());