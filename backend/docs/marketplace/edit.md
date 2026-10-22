### **PATCH /marketplaces/:id**

Mengubah marketplace secara parsial: hanya field yang dikirim yang berubah. Minimal satu hal harus dikirim (`name`, `is_active`, atau `logo`). Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik marketplace yang akan diubah.

#### **Request Body (Multipart / Form-Data)**

- `name` (string, _Opsional_): Nama baru. Maksimum 100 karakter dan harus unik. Mengirim nama yang sama dengan namanya sendiri diperbolehkan.
- `is_active` (boolean, _Opsional_): `"true"` / `"false"`.
- `logo` (file, _Opsional_): Logo baru (PNG, JPEG, WEBP; maksimum 5 MB), diperkecil maksimum 512×512 piksel. Logo lama otomatis dihapus dari storage.

> Field yang tidak dikenal (misalnya `id` atau `logo_url` sebagai teks) ditolak dengan 400. `id` selalu diambil dari URL.
>
> Menonaktifkan marketplace (`is_active: false`) tidak mencabut link yang sudah terpasang di kamera.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90",
    "name": "Tokopedia Official",
    "logo_url": "https://xyz.supabase.co/storage/v1/object/public/marketplace-logos/marketplaces/c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90/2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e.webp",
    "is_active": true
  }
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

2. **404 Not Found** (Marketplace tidak ditemukan)

```json
{
  "errors": "MARKETPLACE_NOT_FOUND"
}
```

3. **409 Conflict** (Nama sudah dipakai marketplace lain, termasuk saat dua edit bersamaan)

```json
{
  "errors": "MARKETPLACE_ALREADY_EXIST"
}
```

4. **400 Bad Request** (Tidak ada yang dikirim, validasi gagal, ID bukan UUID, atau file tidak valid)

```json
{
  "errors": "NOTHING_TO_UPDATE" // atau "INVALID_IMAGE_FORMAT", "INVALID_IMAGE", "IMAGE_TOO_LARGE", "INVALID_IMAGE_FIELD"
}
```

5. **500 Internal Server Error**

```json
{
  "errors": "LOGO_UPLOAD_FAILED" // atau "MARKETPLACE_BUCKET_NOT_CONFIGURED"
}
```

> Jika request gagal, tidak ada yang berubah: nama tetap, logo lama tetap, dan logo baru yang sempat ter-upload otomatis dihapus.