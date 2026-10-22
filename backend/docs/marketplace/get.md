### **GET /marketplaces/:id**

Mengambil satu marketplace berdasarkan ID. Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik marketplace.

---

#### **Response Sukses (200 OK)**

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

2. **404 Not Found** (Marketplace tidak ditemukan)

```json
{
  "errors": "MARKETPLACE_NOT_FOUND"
}
```

3. **400 Bad Request** (ID bukan UUID)
