### **GET /owner/orders**

Daftar order untuk **owner**, lengkap dengan modal dan laba per order, filter, dan ringkasan lunas vs belum lunas. Memerlukan autentikasi (cookie, lihat `auth-overview.md`) dan role **OWNER**. ADMIN mendapat 403.

#### **Query Parameters**

- `search` (string, _Optional_): maksimum 100 karakter, tidak membedakan huruf besar dan kecil. Dicocokkan sebagian dengan **nomor invoice**, **nama pelanggan**, **id pelanggan** (`cust-...`), atau **nomor WhatsApp** (boleh `0812...`, `+62812...`, `62812...`; minimal 3 digit).
- `type` (string, _Optional_): `SALE` atau `REFUND`.
- `payment_status` (string, _Optional_): `PAID` atau `UNPAID`.
- `date_field` (string, _Optional_): tanggal yang difilter, `created_at` (bawaan, tanggal order dibuat) atau `paid_at` (tanggal lunas).
- `date_from` (string `YYYY-MM-DD`, _Optional_): mulai tanggal ini, **jam WIB**, inklusif.
- `date_to` (string `YYYY-MM-DD`, _Optional_): sampai tanggal ini, **jam WIB**, inklusif (sampai pukul 23.59.59 WIB).
- `page` (number, _Optional_): minimal `1`, bawaan `1`.

> Parameter lain, tanggal yang tidak ada (misalnya `2026-02-31`), atau `date_from` lebih besar dari `date_to` ditolak dengan 400.

Satu halaman berisi 20 order, yang terbaru dibuat tampil lebih dulu.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "7c1e...-uuid",
      "type": "SALE",
      "payment_status": "PAID",
      "paid_at": "2026-10-20T03:00:00.000Z",
      "created_at": "2026-10-20T01:00:00.000Z",
      "total_amount": 27000000,
      "customer_id": "cust-K7M2Q",
      "customer_name": "Budi Santoso",
      "whatsapp": "6281234567890",
      "no_invoice": "WAV-20261020-AAAAAA",
      "item_count": 2,
      "capital_total": 23000000,
      "profit": 4000000
    }
  ],
  "summary": {
    "paid": { "count": 1, "amount": 27000000 },
    "unpaid": { "count": 3, "amount": 54000000 }
  },
  "paging": { "page": 1, "per_page": 20, "total": 5, "total_pages": 1 }
}
```

- `total_amount`: nominal akhir order (sesudah diskon, tanpa ongkir).
- `item_count`: jumlah seluruh barang (total `quantity`).
- `capital_total`: total modal barang di order itu, dari **salinan modal saat order dibuat** (bukan modal kamera sekarang).
- `profit`: `total_amount - capital_total`.
- Untuk order `REFUND`, `capital_total` dan `profit` bernilai `null`.
- `customer_id` dan `no_invoice` bisa `null` (data lama).
- `summary` menghitung order **SALE saja** (refund tidak ikut) dengan filter `search` dan tanggal yang sama, tetapi **mengabaikan** filter `payment_status` dan `type`, supaya selalu terlihat perbandingan lunas dan belum lunas. Kalau `type=REFUND`, semua nilainya `0`.

---

#### **Response Error**

1. **400 Bad Request**: parameter tidak valid atau tidak dikenal, atau `INVALID_DATE_RANGE`.
2. **401 Unauthorized** dan **403 Forbidden**: lihat `auth-overview.md`.
