### **Refund**

Refund hanya untuk order penjualan (`SALE`) yang sudah **lunas**. Admin dan owner boleh membuat refund. Semua endpoint memerlukan autentikasi.

Aturan umum:
- Refund **tidak otomatis lunas**. Dibuat `UNPAID` kecuali dikirim `payment_status: "PAID"` saat dibuat. Setelah dibuat, status diubah lewat `PATCH /owner/orders/:id/payment-status` (role OWNER, lihat `owner-orders-payment-status-patch.md`).
- Setiap refund punya **invoice sendiri** (nomor `WAV-YYYYMMDD-XXXXXX`) dan customer yang sama dengan order asli.
- Pilih kamera dan jumlahnya. Jumlah tidak boleh melebihi yang dibeli dikurangi refund sebelumnya (refund yang belum lunas ikut dihitung).
- Setiap item punya `restocked`. `true` berarti barang kembali ke stok: stok kamera bertambah saat refund **lunas**. `false` berarti stok tidak berubah (barang rusak, dll).
- Laporan memakai tanggal lunas refund (`paid_at`). Refund `UNPAID` belum masuk laporan.

---

### **POST /admin/orders/:id/refunds**

Membuat refund untuk order `:id`.

#### **Request Body (JSON)**

```json
{
  "items": [
    { "camera_id": "uuid-kamera", "quantity": 1, "restocked": true }
  ],
  "amount": 9600000,
  "payment_method": "Transfer",
  "payment_status": "PAID",
  "paid_at": "2026-10-30T14:30:00+07:00"
}
```

- `items` (array, **wajib**, 1-100): satu kamera satu baris (tidak boleh kembar).
  - `camera_id` (string UUID, **wajib**): harus ada di order asli.
  - `quantity` (integer, **wajib**, minimal 1).
  - `restocked` (boolean, **wajib**).
- `amount` (integer rupiah, _Optional_): nominal yang dikembalikan ke customer. Kalau kosong dihitung otomatis (lihat bawah). Tidak boleh melebihi sisa nominal yang belum direfund.
- `payment_method` (string, _Optional_, maks 100).
- `payment_status` (string, _Optional_): `PAID` atau `UNPAID`. Default `UNPAID`.
- `paid_at` (string tanggal ISO 8601, _Optional_): hanya boleh dengan `PAID`. Kosong berarti sekarang. Tidak boleh di masa depan dan tidak boleh sebelum order asli dilunasi.

Field lain ditolak dengan 400.

**Nominal otomatis**
- Sebanding dengan harga x jumlah barang yang direfund dari total order **setelah diskon**. Contoh: total order Rp 24.000.000 (setelah diskon), refund 1 kamera Rp 10.000.000 dari subtotal Rp 25.000.000 menjadi Rp 9.600.000.
- Dibulatkan ke rupiah terdekat dan tidak pernah melebihi sisa.
- Refund yang **menghabiskan semua sisa barang** mendapat **sisa nominal**, jadi jumlah semua refund tepat sama dengan total order.

**Kalau `payment_status: "PAID"`**: stok item `restocked: true` langsung bertambah. Semua dilakukan dalam satu transaksi dan dengan kunci pada order asli, jadi dua refund bersamaan tidak bisa melewati jatah barang.

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "id": "uuid-refund",
    "type": "REFUND",
    "refund_of_id": "uuid-order-asli",
    "no_invoice": "WAV-20261030-K7M2QX",
    "payment_method": "Transfer",
    "payment_status": "UNPAID",
    "paid_at": null,
    "total_amount": 9600000,
    "customer_id": "cust-AAAAA",
    "created_at": "2026-10-30T07:00:00.000Z",
    "items": [
      {
        "camera_id": "uuid-kamera",
        "camera_name": "Canon R6",
        "camera_price": 10000000,
        "quantity": 1,
        "restocked": true
      }
    ]
  }
}
```

#### **Response Error**

1. **400 Bad Request**: validasi gagal, `{ "errors": "PAID_AT_BEFORE_ORDER" }`, atau `{ "errors": "ITEM_NOT_IN_ORDER", "camera_ids": ["..."] }`.
2. **401 Unauthorized** dan **403 Forbidden**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "ORDER_NOT_FOUND" }`
4. **409 Conflict**:
   - `{ "errors": "ORDER_NOT_PAID" }`: order asli belum lunas.
   - `{ "errors": "ORDER_NOT_SALE" }`: `:id` adalah order refund.
   - `{ "errors": "REFUND_EXCEEDS_PURCHASED", "cameras": [{ "camera_id": "...", "name": "Canon R6", "requested": 3, "refundable": 2 }] }`
   - `{ "errors": "REFUND_AMOUNT_EXCEEDS", "max": 14400000 }`: `amount` melebihi sisa nominal.
5. **500**: `{ "errors": "INVOICE_NUMBER_GENERATION_FAILED" }` (sangat jarang, coba lagi).
6. **503**: `{ "errors": "STORE_NOT_READY" }`: data toko belum diisi.

---

### **GET /admin/orders/:id/refunds**

Ringkasan refund sebuah order: sisa barang yang masih bisa direfund, sisa nominal, dan daftar refund. Dipakai form "Ajukan refund" untuk membatasi jumlah.

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "order": {
      "id": "uuid-order",
      "payment_status": "PAID",
      "paid_at": "2026-10-20T03:00:00.000Z",
      "total_amount": 24000000
    },
    "items": [
      {
        "camera_id": "uuid-kamera",
        "camera_name": "Canon R6",
        "camera_price": 10000000,
        "purchased": 2,
        "refunded": 1,
        "refundable": 1
      }
    ],
    "amount": { "total": 24000000, "refunded": 9600000, "refundable": 14400000 },
    "refunds": [ { "id": "uuid-refund", "type": "REFUND", "...": "bentuk sama dengan response POST" } ]
  }
}
```

- `items` urut nama kamera. `refunded` dan `amount.refunded` menghitung semua refund (lunas maupun belum).
- `refunds` terbaru di atas.
- Order yang belum lunas tetap bisa dilihat, tetapi tidak bisa dibuatkan refund (cek `order.payment_status`).

**Error**: 400 (id bukan UUID), 401, 403, 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_SALE` (id adalah refund).

---

### **DELETE /admin/refunds/:id**

Membatalkan refund yang **belum lunas** (salah input). Order refund beserta invoicenya dihapus dan jatah barang/nominal kembali. Refund yang sudah lunas tidak bisa dihapus: ubah dulu ke `UNPAID` lewat endpoint status (owner), lalu hapus.

#### **Response Sukses (200 OK)**

```json
{ "message": "REFUND_DELETED" }
```

**Error**: 400 (id bukan UUID), 401, 403, 404 `REFUND_NOT_FOUND` (id tidak ada atau bukan refund), 409 `REFUND_ALREADY_PAID`.
