-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ip_v4" TEXT,
    "ip_v6" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "ip_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AttendanceDevice_label_chk" CHECK (btrim ("label") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_token_hash_key" ON "AttendanceDevice" ("token_hash");