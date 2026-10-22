### **POST /marketplaces**

Membuat marketplace baru beserta logonya. Logo di-upload ke storage, diperkecil maksimum 512×512 piksel, dan disimpan sebagai WEBP. Memerlukan autentikasi (_Bearer Token_).

#### **Request Body (Multipart / Form-Data)**

- `name` (string, **Required**): Nama marketplace. Maksimum 100 karakter, spasi di awal dan akhir dibuang. Harus **unik**.
- `logo` (file, **Required**): Satu berkas gambar (PNG, JPEG, WEBP; maksimum 5 MB).
- `is_active` (boolean, _Opsional_): Dikirim sebagai `"true"` / `"false"`. Default `true`.

> Field yang tidak dikenal (misalnya `id` atau `logo_url` sebagai teks) ditolak dengan 400.

---

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "id": "c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90",
    "name": "Tokopedia",
    "logo_url": "https://xyz.supabase.co/storage/v1/object/public/marketplace-logos/marketplaces/c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90/8f14e45f-ceea-467a-9c1d-0d3f1a2b3c4d.webp",
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

2. **409 Conflict** (Nama sudah dipakai, termasuk saat dua request dengan nama sama masuk bersamaan)

```json
{
  "errors": "MARKETPLACE_ALREADY_EXIST"
}
```

3. **400 Bad Request** (Validasi gagal, logo tidak dikirim, atau file tidak valid)

```json
{
  "errors": "LOGO_REQUIRED" // atau "INVALID_IMAGE_FORMAT", "INVALID_IMAGE", "IMAGE_TOO_LARGE", "INVALID_IMAGE_FIELD"
}
```

4. **500 Internal Server Error**

```json
{
  "errors": "LOGO_UPLOAD_FAILED" // atau "MARKETPLACE_BUCKET_NOT_CONFIGURED"
}
```

> Jika penyimpanan ke database gagal, logo yang sempat ter-upload otomatis dihapus.
