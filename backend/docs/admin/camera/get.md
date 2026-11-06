### **GET /admin/cameras/:id**

Mengambil detail satu kamera untuk **admin**. Memerlukan autentikasi (cookie, lihat `auth-overview.md`). Bisa dipakai **ADMIN dan OWNER**.

Data **modal dan profit tidak pernah disertakan**.

#### **Path Parameters**

- `id` (string UUID, **Required**): Id kamera.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "0f6c...-uuid",
    "name": "Canon EOS R6",
    "sku": "CAN-R6-01",
    "serial_number": "SN-102938",
    "color": "Hitam",
    "shutter_count": "1200",
    "price": 25000000,
    "strikethrough_price": null,
    "condition": "SECOND",
    "stock": 3,
    "description": "Kondisi mulus.",
    "inclusions": "Body, baterai, charger",
    "promo": false,
    "best_selling": false,
    "created_at": "2026-10-01T00:00:00.000Z",
    "category": {
      "id": "03c4...-uuid",
      "name": "Kamera",
      "created_at": "2026-10-01T00:00:00.000Z"
    },
    "images": [
      {
        "id": "a1b2...-uuid",
        "camera_id": "0f6c...-uuid",
        "image_url": "https://.../cameras/0f6c.../abc.webp",
        "is_primary": true,
        "created_at": "2026-10-01T00:00:00.000Z"
      }
    ],
    "marketplaceLinks": [
      {
        "id": "c3d4...-uuid",
        "camera_id": "0f6c...-uuid",
        "marketplace_id": "e5f6...-uuid",
        "product_url": "https://tokopedia.com/...",
        "marketplace": {
          "id": "e5f6...-uuid",
          "logo_url": "https://.../logo.png",
          "name": "Tokopedia",
          "is_active": true
        }
      }
    ]
  }
}
```

- `images`: gambar utama di urutan pertama, sisanya dari yang terlama.
- `marketplaceLinks`: hanya link ke marketplace yang **aktif**, diurutkan menurut nama marketplace.
- `sku`, `serial_number`, `color`, `shutter_count`, `strikethrough_price` bisa `null` untuk data lama.

---

#### **Response Error**

1. **400 Bad Request**: `id` bukan UUID.

2. **404 Not Found**

```json
{
  "errors": "CAMERA_NOT_FOUND"
}
```

Kamera tidak ada atau sudah dihapus.

3. **401 Unauthorized** dan **403 Forbidden**. Lihat `auth-overview.md`.
