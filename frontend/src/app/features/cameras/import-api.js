import api from "../../../lib/api/client.js";

/**
 * POST /owner/cameras/import (OWNER)
 * rows: 1-200 baris. dryRun: true hanya memeriksa tanpa menyimpan.
 * Semua-atau-tidak-sama-sekali per kiriman. Kalau ada baris salah, server
 * membalas 400 { errors: "IMPORT_INVALID", row_errors: [...] }.
 */
export async function importCameras({ rows, dryRun = false }) {
  const response = await api.post("/owner/cameras/import", {
    dry_run: dryRun,
    rows,
  });

  return response.data.data;
}
