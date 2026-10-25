-- AlterTable
ALTER TABLE "Banner"
ADD COLUMN "is_best_seller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_promo" BOOLEAN NOT NULL DEFAULT false;
-- Aturan flag banner di level database:
--   1. paling banyak SATU banner dengan is_promo = true
--   2. paling banyak SATU banner dengan is_best_seller = true
--   3. satu banner nggak boleh dua-duanya true
--
-- Partial unique index (WHERE ... = true) nggak bisa ditulis dengan @@unique di
-- schema.prisma. @@unique([is_promo]) membuat unique biasa, yang melarang dua
-- banner dengan is_promo = false. Karena itu dua baris @@unique di model Banner
-- harus dihapus, dan index dibuat lewat SQL ini.

-- Hapus unique biasa kalau sebelumnya sudah ter-migrate (aman kalau belum ada)
DROP INDEX IF EXISTS "unique_active_promo";

DROP INDEX IF EXISTS "unique_active_best_seller";

CREATE UNIQUE INDEX "unique_active_promo" ON "Banner" ("is_promo")
WHERE
    "is_promo" = true;

CREATE UNIQUE INDEX "unique_active_best_seller" ON "Banner" ("is_best_seller")
WHERE
    "is_best_seller" = true;

ALTER TABLE "Banner"
ADD CONSTRAINT "banner_flags_exclusive" CHECK (
    NOT(
        "is_promo"
        AND "is_best_seller"
    )
);