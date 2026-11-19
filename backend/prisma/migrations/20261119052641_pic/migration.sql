-- Tambah PIC; laporan lama diisi nama pembuatnya dari riwayat
ALTER TABLE "DailyReport" ADD COLUMN "pic" TEXT;

UPDATE "DailyReport" r
SET "pic" = COALESCE(
  (SELECT l."user_name"
   FROM "DailyReportLog" l
   WHERE l."report_id" = r."id" AND l."action" = 'REPORT_CREATED' AND btrim(l."user_name") <> ''
   ORDER BY l."seq" ASC
   LIMIT 1),
  'Tanpa nama'
);

ALTER TABLE "DailyReport" ALTER COLUMN "pic" SET NOT NULL;

ALTER TABLE "DailyReport"
ADD CONSTRAINT "DailyReport_pic_chk" CHECK (btrim ("pic") <> '');

-- Simpan id karyawan dan display_id PIC tanpa relasi; laporan lama dibiarkan NULL
ALTER TABLE "DailyReport" ADD COLUMN "pic_employee_id" TEXT;

ALTER TABLE "DailyReport" ADD COLUMN "pic_display_id" TEXT;

ALTER TABLE "DailyReport"
ADD CONSTRAINT "DailyReport_pic_ids_chk" CHECK (
    (
        "pic_employee_id" IS NULL
        AND "pic_display_id" IS NULL
    )
    OR (
        "pic_employee_id" IS NOT NULL
        AND "pic_display_id" IS NOT NULL
        AND btrim ("pic_employee_id") <> ''
        AND btrim ("pic_display_id") <> ''
    )
);