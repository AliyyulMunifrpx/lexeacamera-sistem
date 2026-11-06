### **PATCH /owner/orders/:id/payment-status**

Mengubah status bayar order: **lunas** (`PAID`) atau **belum lunas** (`UNPAID`). Memerlukan autentikasi dan role **OWNER**.

Tanggal lunas (`paid_at`) inilah yang dipakai laporan penjualan. Perubahan dilakukan dalam satu transaksi dengan kunci pada order, jadi dua klik bersamaan tidak membuat data bertentangan. Endpoint ini juga yang **mengatur stok kamera** (lihat bagian Stok di bawah).

#### **Path Parameter**

- `id` (string UUID): id order.

#### **Request Body (JSON)**

```json
{
  "payment_status": "PAID",
  "paid_at": "2026-10-30T14:30:00+07:00"
}
```

- `payment_status` (string, **wajib**): `PAID` atau `UNPAID`.
- `paid_at` (string tanggal ISO 8601, _Optional_): **hanya boleh dengan `PAID`**. Kalau kosong, memakai waktu sekarang. Dipakai untuk mencatat pembayaran yang terjadi lebih awal. Tidak boleh di masa depan dan tidak boleh sebelum order dibuat. Sertakan offset waktu (misalnya `+07:00`) agar tidak ambigu.

Field lain ditolak dengan 400.

**Aturan**
- `UNPAID` ke `PAID`: `paid_at` diisi (dari body atau waktu sekarang).
- `PAID` ke `UNPAID`: `paid_at` dikosongkan. Ditolak kalau order sudah punya refund.
- Status yang sama tanpa `paid_at`: tidak ada perubahan (aman diklik dua kali, tanggal lunas tidak bergeser).
- `PAID` dengan `paid_at` baru pada order yang sudah lunas: tanggal lunas dikoreksi.
- Bisa untuk order `SALE` maupun `REFUND`.

**Stok**
- `UNPAID` ke `PAID`: stok tiap kamera di order **berkurang** sebanyak jumlahnya. Kalau satu kamera ada di beberapa baris, jumlahnya digabung.
- `PAID` ke `UNPAID`: stok **dikembalikan** sebesar yang tadi dikurangi.
- `PAID` lagi, atau koreksi `paid_at`: stok tidak berubah.
- Kalau stok salah satu kamera tidak cukup, **semuanya dibatalkan**: order tetap belum lunas dan tidak ada stok yang berubah.
- Dua order yang dilunasi bersamaan untuk unit terakhir: hanya satu yang berhasil, yang lain mendapat `INSUFFICIENT_STOCK`.
- Stok tidak perlu lagi diedit manual setiap ada kamera laku. Edit manual hanya untuk koreksi (barang masuk, hilang, dll).

**Stok untuk order `REFUND`** (kebalikan penjualan, hanya item yang `restocked: true`)
- `UNPAID` ke `PAID`: stok kamera **bertambah**.
- `PAID` ke `UNPAID`: stok **berkurang lagi**. Kalau stoknya sudah tidak cukup (sudah terjual), ditolak dengan `INSUFFICIENT_STOCK`.
- Item `restocked: false` tidak pernah mengubah stok.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "7c1e...-uuid",
    "payment_status": "PAID",
    "paid_at": "2026-10-30T07:30:00.000Z"
  }
}
```

`paid_at` bernilai `null` kalau `UNPAID`.

---

#### **Response Error**

1. **400 Bad Request**: validasi gagal (status salah, `paid_at` bukan tanggal, di masa depan, atau dikirim bersama `UNPAID`), atau `{ "errors": "PAID_AT_BEFORE_ORDER" }`.
2. **401 Unauthorized** dan **403 Forbidden**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "ORDER_NOT_FOUND" }`
4. **409 Conflict**:
   - `{ "errors": "INSUFFICIENT_STOCK", "cameras": [{ "camera_id": "...", "name": "Canon R6", "requested": 2, "stock": 1 }] }`: stok tidak cukup untuk dilunasi.
   - `{ "errors": "ORDER_HAS_REFUNDS" }`: tidak bisa kembali ke belum lunas karena sudah ada refund.
