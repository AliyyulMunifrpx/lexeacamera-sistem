
### **PATCH /cameras/:id**

Memperbarui data kamera yang ada (mendukung _partial update_ dan sinkronisasi _marketplace links_). Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik dari kamera yang akan di-update.

#### **Request Body (JSON)**

Semua field di bawah ini bersifat opsional (bisa dikirim sebagian/patch), kecuali jika ingin diubah nilainya:

- `name` (string, maks 100 karakter)
- `price` (number, minimal 0)
- `condition` (string: `"NEW"` atau `"SECOND"`)
- `stock` (integer, minimal 0)
- `description` (string, maks 1000 karakter)
- `inclusions` (string, maks 1000 karakter)
- `category_id` (string, UUID)
- `promo` (boolean)
- `best_selling` (boolean)
- `marketplace` (array of objects):
- `marketplace_id` (string, UUID)
- `product_url` (string, URL valid)

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "dbdc9eab-6262-45ec-a04b-c1bcce75052f",
    "name": "Nikon D3500 (Updated)",
    "price": 7000000,
    "condition": "NEW",
    "stock": 10,
    "description": "Kamera baru segel",
    "inclusions": "Body, lensa kit",
    "promo": false,
    "best_selling": true,
    "created_at": "2026-10-20T10:15:54.095Z",
    "category": {
      "id": "f89d3d4b-1234-4bcd-8ef9-c1bcce754321",
      "name": "cat_b_t1792"
    },
    "marketplaceLinks": [
      {
        "marketplace_id": "mp-uuid-1234",
        "product_url": "https://shopee.co.id/canon"
      }
    ]
  }
}
```

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid atau tidak disertakan)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Kamera, Kategori, atau Marketplace tidak ditemukan)

```json
{
  "errors": "CAMERA_NOT_FOUND" // atau "CATEGORY_NOT_FOUND" / "MARKETPLACE_NOT_FOUND"
}
```

3. **400 Bad Request** (Validasi Joi gagal / format data salah / body kosong / format UUID salah)

```json
{
  "errors": "\"name\" is not allowed to be empty"
}
```

4. **409 Conflict** (Konflik data unik pada database atau _race condition_ saat update bersamaan)

```json
{
  "errors": "CAMERA_UPDATE_CONFLICT"
}
```
