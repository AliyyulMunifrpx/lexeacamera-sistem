### **POST /orders**

Pembeli publik membuat pesanan. Tidak perlu login. Dibatasi oleh `orderLimiter`.

Server mengambil harga dari data kamera, jadi harga **tidak boleh** dikirim klien. Stok dicek tetapi **tidak dikurangi**. Pesanan baru selalu berstatus **belum lunas** (`UNPAID`).

Pelanggan dicari lewat **nomor WhatsApp** (dinormalkan: `0812...`, `+62812...`, dan `62812...` dianggap sama). Kalau belum ada, pelanggan baru dibuat otomatis dengan id `cust-XXXXX`. Kalau sudah ada, pelanggan lama dipakai dan **datanya tidak diubah**. Nama dan alamat yang diketik di pesanan ini hanya disimpan di pesanan dan invoice-nya.

#### **Request Body (JSON)**

```json
{
  "customer_name": "Budi",
  "address": "Jl. Mawar 1",
  "whatsapp": "081234567890",
  "instagram": "budi.s",
  "items": [{ "camera_id": "0f6c...-uuid", "quantity": 2 }]
}
```

- `customer_name` (string, **wajib**): maksimum 100 karakter.
- `address` (string, **wajib**): maksimum 500 karakter.
- `whatsapp` (string, **wajib**): 8 sampai 15 digit, boleh diawali `+`.
- `instagram` (string, _Optional_): maksimum 100 karakter. `""` atau `null` berarti kosong.
- `items` (array, **wajib**): 1 sampai 10 item, `camera_id` tidak boleh dobel.
  - `camera_id` (string UUID, **wajib**)
  - `quantity` (number, _Optional_): 1 sampai 10, bawaan `1`.

Field lain (misalnya `price` atau `total_amount`) ditolak dengan 400.

---

#### **Response Sukses (201 Created)**

Semua nominal berupa **angka rupiah (Int)**, bukan string.

```json
{
  "data": {
    "no_invoice": "WAV-20261031-K7M2QX",
    "customer_name": "Budi",
    "total_amount": 50000000,
    "created_at": "2026-10-31T01:00:00.000Z",
    "items": [
      {
        "camera_name": "Canon EOS R6",
        "camera_price": 25000000,
        "quantity": 2,
        "line_total": 50000000
      }
    ]
  }
}
```

---

#### **Response Error**

1. **400 Bad Request**
   - Validasi gagal (field wajib kosong, format WhatsApp salah, item dobel, field tidak dikenal).
   - `INSUFFICIENT_STOCK`: jumlah melebihi stok.
   - `AMOUNT_TOO_LARGE`: total melebihi batas angka yang bisa disimpan (2.147.483.647).
2. **404 Not Found**: `{ "errors": "CAMERA_NOT_FOUND" }` (kamera tidak ada atau sudah dihapus).
3. **429 Too Many Requests**: dari `orderLimiter`.
4. **500 Internal Server Error**: `CAMERA_PRICE_INVALID` (data harga atau modal kamera rusak) atau `INVOICE_NUMBER_GENERATION_FAILED` (sangat jarang, kirim ulang).
5. **503 Service Unavailable**: `STORE_NOT_READY` (data toko belum diisi).
