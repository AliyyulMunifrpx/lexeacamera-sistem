

### **PATCH /cameras/:id/images**

Memperbarui galeri foto kamera secara spesifik (menghapus foto lama, mempertahankan foto lama, mengunggah foto baru, dan mengatur ulang foto utama). Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik dari kamera yang galeri fotonya akan di-update.

#### **Request Body (Multipart / Form-Data)**

- `keep_image_ids` (string, **Required** - dikirim dalam format JSON string array of UUID): Daftar ID foto lama yang ingin dipertahankan. Jika kosong, kirim `[]`.
- `primary` (string, _Opsional_):
- UUID dari foto yang ingin dijadikan foto utama (_primary_).
- Atau format `"new:N"` (contoh: `"new:0"`) untuk langsung menjadikan foto baru yang di-upload pada indeks ke-N sebagai foto utama.

- `images` (file(s), _Opsional_): Berkas file gambar baru (mendukung format PNG, JPEG, WEBP; maksimum 5 foto total gabungan antara foto yang di-keep dan foto baru).

---

#### **Response Sukses (200 OK)**

Mengembalikan daftar terbaru dari seluruh foto kamera yang aktif:

```json
{
  "data": [
    {
      "id": "img-uuid-1111",
      "camera_id": "dbdc9eab-6262-45ec-a04b-c1bcce75052f",
      "image_url": "https://xyz.supabase.co/storage/v1/object/public/camera-images/cameras/abc/camera-0.webp",
      "is_primary": true,
      "created_at": "2026-10-20T10:15:54.095Z"
    },
    {
      "id": "img-uuid-2222",
      "camera_id": "dbdc9eab-6262-45ec-a04b-c1bcce75052f",
      "image_url": "https://xyz.supabase.co/storage/v1/object/public/camera-images/cameras/abc/camera-1.webp",
      "is_primary": false,
      "created_at": "2026-10-20T10:15:54.095Z"
    }
  ]
}
```

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Kamera tidak ditemukan, atau ID foto pada `keep` / `primary` tidak terdaftar / milik kamera lain)

```json
{
  "errors": "CAMERA_NOT_FOUND" // atau "CAMERA_IMAGE_NOT_FOUND"
}
```

3. **400 Bad Request** (Validasi gagal, format UUID salah, file bukan gambar valid, format `keep_image_ids` bukan JSON valid, atau melanggar aturan jumlah gambar min 1 / maks 5)

```json
{
  "errors": "CAMERA_IMAGES_REQUIRED" // atau "TOO_MANY_CAMERA_IMAGES", "INVALID_KEEP_IMAGE_IDS", "INVALID_IMAGE_FORMAT"
}
```

