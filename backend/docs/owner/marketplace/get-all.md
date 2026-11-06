### **GET /marketplaces**

Mengambil semua marketplace, diurutkan berdasarkan nama. Tanpa paginasi. Memerlukan autentikasi (_Bearer Token_).

#### **Query Parameters**

- `is_active` (boolean, _Opsional_): `true` untuk hanya yang aktif, `false` untuk hanya yang nonaktif. Jika tidak dikirim, semua ditampilkan.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90",
      "name": "Shopee",
      "logo_url": "https://xyz.supabase.co/storage/v1/object/public/marketplace-logos/marketplaces/c0a8f2d4-6f1e-4a39-9b27-3e5d1a7c8b90/8f14e45f-ceea-467a-9c1d-0d3f1a2b3c4d.webp",
      "is_active": true
    },
    {
      "id": "7e3b9d51-2a4c-4f68-8e10-5b9c3d2a1f77",
      "name": "Tokopedia",
      "logo_url": "https://xyz.supabase.co/storage/v1/object/public/marketplace-logos/marketplaces/7e3b9d51-2a4c-4f68-8e10-5b9c3d2a1f77/1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d.webp",
      "is_active": false
    }
  ]
}
```

Jika belum ada marketplace, `data` berupa array kosong `[]`.

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **400 Bad Request** (`is_active` bukan `true` / `false`)