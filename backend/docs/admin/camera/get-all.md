### **GET /admin/cameras**

Mengambil daftar kamera untuk **admin**, dengan pencarian dan filter kategori. Memerlukan autentikasi (cookie, lihat `auth-overview.md`). Bisa dipakai **ADMIN dan OWNER**.

Data **modal dan profit tidak pernah disertakan**. Admin hanya melihat harga jual dan detail yang diperlukan. Kamera yang sudah dihapus tidak ditampilkan.

#### **Query Parameters**

- `search` (string, _Optional_): Maksimum 100 karakter. Dicocokkan sebagian dengan **nama atau SKU**, tidak membedakan huruf besar dan kecil. Kosong sama dengan tanpa pencarian.
- `category_id` (string UUID, _Optional_): Hanya kamera di kategori ini. Digabung dengan `search` (keduanya harus cocok).
- `page` (number, _Optional_): Halaman, bilangan bulat minimal `1`. Bawaan `1`.

> Parameter lain (misalnya `modal` atau `min_price`) **ditolak** dengan 400.

Satu halaman berisi 20 kamera, diurutkan dari yang terbaru.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "0f6c...-uuid",
      "name": "Canon EOS R6",
      "sku": "CAN-R6-01",
      "price": 25000000,
      "strikethrough_price": 27000000,
      "stock": 3,
      "condition": "NEW",
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
      ]
    }
  ],
  "paging": {
    "page": 1,
    "per_page": 20,
    "total": 3,
    "total_pages": 1
  }
}
```

- `sku` dan `strikethrough_price` bisa `null` (data lama atau tanpa harga coret).
- `images` berisi **gambar utama saja** (satu item), atau array kosong kalau belum ada.

---

#### **Response Error**

1. **400 Bad Request** (Validasi gagal)

```json
{
  "errors": "\"page\" must be greater than or equal to 1" // atau pesan validasi lain
}
```

Muncul jika `category_id` bukan UUID, `page` tidak valid, `search` lebih dari 100 karakter, atau ada parameter yang tidak dikenal.

2. **401 Unauthorized**. Lihat `auth-overview.md`.
