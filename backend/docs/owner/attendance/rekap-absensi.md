## Rekap absen (OWNER)

Memerlukan autentikasi dan role **OWNER**.

### **GET /owner/attendances**

**Query:** `employee_id` (UUID), `date_from` dan `date_to` (`YYYY-MM-DD`, jam **WIB**, inklusif, dihitung dari waktu absen masuk), `page` (bawaan 1). Parameter lain, tanggal yang tidak ada, atau `date_from` lebih besar dari `date_to` ditolak (400). 50 per halaman, terbaru dulu.

**Response (200)**

```json
{
  "data": [
    {
      "id": "7c1e...-uuid",
      "check_in_at": "2026-10-29T02:00:00.000Z",
      "check_out_at": "2026-10-29T10:30:00.000Z",
      "employee": { "id": "0f6c...-uuid", "name": "Ani" },
      "status": "DONE",
      "duration_minutes": 510
    }
  ],
  "paging": { "page": 1, "per_page": 50, "total": 1, "total_pages": 1 }
}
```

- `status`: `DONE` (sudah pulang), `OPEN` (masih di toko, sesi hari ini), `MISSED` (lupa absen pulang: sesi dari hari WIB sebelumnya yang belum ditutup, atau sudah ditandai otomatis).
- `duration_minutes`: `null` kalau belum ada jam pulang.

### **PATCH /owner/attendances/:id**

Mengisi atau memperbaiki jam pulang (misalnya karyawan lupa absen pulang), atau **membatalkan** absen pulang yang salah tekan.

**Request Body**: `{ "check_out_at": "2026-10-29T10:00:00+07:00" }` (ISO 8601, **wajib**, tidak boleh di masa depan), atau `{ "check_out_at": null }` untuk membuka kembali sesi.

**Aturan isi jam pulang:** harus sesudah jam masuk, paling lama 24 jam sesudahnya, dan tidak boleh melewati jam masuk sesi berikutnya milik karyawan yang sama. Setelah diisi, status menjadi `DONE`.

**Aturan buka kembali (`null`):** jam pulang dihapus dan tanda terlewat dibersihkan. Kalau sesinya dari hari ini, karyawan bisa absen pulang lagi. Kalau dari hari sebelumnya, statusnya menjadi `MISSED` (isi jam pulang yang benar). Kalau sesi itu memang sudah terbuka, tidak ada yang berubah.

**Response (200)**: objek rekap seperti di atas.

**Error:** `400` (validasi, `CHECKOUT_BEFORE_CHECKIN`, `CHECKOUT_TOO_LATE`), `404 ATTENDANCE_NOT_FOUND`, `409 OVERLAPS_NEXT_ATTENDANCE`, `409 ANOTHER_ATTENDANCE_OPEN` (membuka kembali sesi lama saat karyawan itu punya sesi lain yang masih terbuka).
