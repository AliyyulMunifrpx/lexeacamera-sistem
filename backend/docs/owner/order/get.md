### **GET /owner/orders/:id**

Detail satu order untuk **owner**, termasuk modal, laba, data pelanggan, invoice, dan refund yang terkait. Memerlukan autentikasi dan role **OWNER**.

#### **Path Parameter**

- `id` (string UUID): id order.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "7c1e...-uuid",
    "type": "SALE",
    "refund_of_id": null,
    "payment_status": "PAID",
    "paid_at": "2026-10-20T03:00:00.000Z",
    "created_at": "2026-10-20T01:00:00.000Z",
    "customer_name": "Budi Santoso",
    "address": "Jl. A",
    "whatsapp": "6281234567890",
    "instagram": null,
    "customer": {
      "id": "cust-K7M2Q",
      "name": "Budi Santoso",
      "whatsapp": "6281234567890",
      "instagram": "budi"
    },
    "subtotal": 28000000,
    "store_discount": 1000000,
    "customer_discount": 0,
    "total_amount": 27000000,
    "capital_total": 23000000,
    "profit": 4000000,
    "invoice": {
      "id": "a91f...-uuid",
      "no_invoice": "WAV-20261020-AAAAAA",
      "payment_method": "Transfer",
      "ship": "JNE",
      "store_discount": 1000000,
      "customer_discount": null,
      "is_final": false
    },
    "refunds": [
      {
        "id": "b22c...-uuid",
        "total_amount": 3000000,
        "created_at": "2026-10-25T01:00:00.000Z"
      }
    ],
    "items": [
      {
        "id": "i-1",
        "camera_id": "0f6c...-uuid",
        "camera_name": "Canon EOS R6",
        "sku": "CAN-R6-01",
        "camera_price": 25000000,
        "camera_modal": 21000000,
        "quantity": 1,
        "line_total": 25000000,
        "line_capital": 21000000,
        "restocked": false
      }
    ]
  }
}
```

- `customer_name`, `address`, `whatsapp`, dan `instagram` di tingkat atas adalah **salinan saat order dibuat**. `customer` adalah data pelanggan **terbaru** (bisa `null` untuk order lama).
- `subtotal`: jumlah semua `line_total`. `total_amount`: nominal akhir sesudah diskon (tanpa ongkir).
- `capital_total` dan `profit` bernilai `null` untuk order `REFUND`.
- `invoice` bisa `null`. `refunds` berisi order refund yang menunjuk ke order ini (kosong kalau belum ada).
- `restocked` hanya berarti untuk item di order `REFUND`.

---

#### **Response Error**

1. **400 Bad Request**: `id` bukan UUID.
2. **401 Unauthorized** dan **403 Forbidden**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "ORDER_NOT_FOUND" }`
