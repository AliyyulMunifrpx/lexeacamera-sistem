### **PUT /admin/cameras/:id/images**

Menambah dan menghapus **gambar** pada kamera yang sudah ada, untuk **admin**. Memerlukan autentikasi (cookie, lihat `auth-overview.md`). Bisa dipakai **ADMIN dan OWNER**. Hanya gambar yang diubah, data kamera lain tidak tersentuh.

Request memakai `multipart/form-data`. Hasil akhirnya adalah: gambar lama yang disebut di `keep_image_ids` dipertahankan, gambar lama lainnya **dihapus**, dan file yang diunggah **ditambahkan**.

#### **Path Parameters**

- `id` (string UUID, **Required**): Id kamera.

#### **Form Fields**

- `keep_image_ids` (string, **Required**): Array JSON berisi id gambar lama yang dipertahankan, contoh `["uuid-1","uuid-2"]`. Kirim `[]` untuk menghapus semua gambar lama.
- `images` (file, _Optional_, bisa banyak): Gambar baru. Format gambar apa pun yang valid, otomatis diubah ke WebP dengan sisi terpanjang maksimum 1600 px.
- `primary` (string, _Optional_): Gambar utama. Isi dengan id gambar lama yang dipertahankan, atau `new:N` untuk file baru ke-N (mulai dari `0`). Kalau tidak dikirim, gambar utama yang sekarang dipertahankan (atau gambar pertama kalau yang lama dihapus).

Aturan: jumlah akhir gambar (yang dipertahankan ditambah yang baru) minimal **1** dan maksimal **12**.

---

#### **Response Sukses (200 OK)**

Daftar gambar kamera setelah perubahan, gambar utama di urutan pertama:

```json
{
  "data": [
    {
      "id": "a1b2...-uuid",
      "camera_id": "0f6c...-uuid",
      "image_url": "https://.../cameras/0f6c.../abc.webp",
      "is_primary": true,
      "created_at": "2026-10-01T00:00:00.000Z"
    }
  ]
}
```

- Perubahan di database dilakukan sekaligus (semua berhasil atau tidak sama sekali). File gambar lama baru dihapus dari penyimpanan setelah perubahan tersimpan.
- Dua perubahan gambar pada kamera yang sama diproses bergantian.

---

#### **Response Error**

1. **400 Bad Request**

- `INVALID_KEEP_IMAGE_IDS`: `keep_image_ids` bukan JSON yang valid.
- `CAMERA_IMAGES_REQUIRED`: jumlah akhir gambar 0.
- `TOO_MANY_CAMERA_IMAGES`: jumlah akhir lebih dari 12.
- `INVALID_PRIMARY_IMAGE`: `primary` tidak termasuk gambar yang dipertahankan atau file baru.
- `INVALID_IMAGE_FORMAT` atau `INVALID_IMAGE`: file bukan gambar yang bisa diproses.
- Pesan validasi lain jika `id` bukan UUID atau `keep_image_ids` bukan array UUID yang unik.

2. **404 Not Found**

- `CAMERA_NOT_FOUND`: kamera tidak ada atau sudah dihapus.
- `CAMERA_IMAGE_NOT_FOUND`: ada id di `keep_image_ids` yang bukan gambar kamera ini.

3. **500 Internal Server Error**

- `CAMERA_IMAGE_UPLOAD_FAILED`: gagal mengunggah ke penyimpanan. Tidak ada perubahan tersimpan.
- `CAMERA_BUCKET_NOT_CONFIGURED`: konfigurasi server belum lengkap.

4. **401 Unauthorized** dan **403 Forbidden**. Lihat `auth-overview.md`.
