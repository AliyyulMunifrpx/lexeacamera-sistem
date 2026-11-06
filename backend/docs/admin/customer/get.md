### **GET /admin/customers/:id**

Detail satu pelanggan beserta statistik dan daftar ordernya. Memerlukan autentikasi. Bisa dipakai **ADMIN dan OWNER**.

#### **Path Parameter**

- `id` (string): id pelanggan, format `cust-` diikuti 5 karakter huruf besar atau angka (contoh `cust-K7M2Q`). Format lain ditolak dengan 400.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "cust-K7M2Q",
    "name": "Budi Santoso",
    "whatsapp": "6281234567890",
    "instagram": "budi.s",
    "address": "Jl. Mawar 1",
    "created_at": "2026-10-03T00:00:00.000Z",
    "order_count": 3,
    "total_spent": 13000000,
    "orders": [
      {
        "id": "7c1e...-uuid",
        "type": "REFUND",
        "refund_of_id": "a91f...-uuid",
        "payment_status": "PAID",
        "paid_at": "2026-10-13T00:00:00.000Z",
        "total_amount": 2000000,
        "created_at": "2026-10-13T00:00:00.000Z",
        "invoice": { "no_invoice": "WAV-20261013-K7M2QX" }
      }
    ]
  }
}
```

- `orders`: order terbaru lebih dulu, **maksimal 50**. `order_count` tetap jumlah keseluruhan.
- `type`: `SALE` atau `REFUND`. `refund_of_id` hanya terisi untuk `REFUND`.
- `payment_status`: `PAID` atau `UNPAID`. `paid_at` `null` kalau belum lunas.
- `invoice` bisa `null` kalau order tidak punya invoice.
- Arti `order_count` dan `total_spent` sama dengan di daftar pelanggan.

---

#### **Response Error**

1. **400 Bad Request**: format `id` salah.
2. **401 Unauthorized**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "CUSTOMER_NOT_FOUND" }`
