### **Invoice (Admin)**

Endpoint `/admin/invoices`. Memerlukan autentikasi dan role ADMIN atau OWNER. Semua nominal berupa **angka bulat rupiah** (bukan string).

Invoice dibuat bersama Order dan item-nya. Harga dan nama kamera adalah snapshot saat dibuat. Stok tidak dicek dan tidak berubah saat invoice dibuat (stok mengikuti status bayar, lihat `owner-orders-payment-status-patch.md`).

Aturan total: `total_amount = subtotal - store_discount - customer_discount`. `Order.total_amount` selalu sama dengan `total_amount` invoice (setelah diskon, tanpa ongkir).

Versi admin **tidak** memuat modal (HPP) dan laba. Rincian itu hanya ada di `/owner/invoices`.

Field umum di semua respons invoice: `type` (`SALE` atau `REFUND`), `payment_status` (`PAID`/`UNPAID`), `paid_at`, `customer_id`, `subtotal`, `items`.

---

### **POST /admin/invoices**

Membuat invoice.

#### **Request Body (JSON)**

- `customer_name` (string, **wajib**, maks 100), `customer_address` (string, **wajib**, maks 500), `customer_whatsapp` (string, **wajib**, 8-15 digit, boleh diawali `+`).
- `customer_instagram` (string, _Optional_, maks 100).
- `items` (array, **wajib**, 1-10): `camera_id` (UUID, tidak boleh dobel) dan `quantity` (integer 1-10, default 1).
- `payment_method`, `ship` (string, _Optional_, maks 100).
- `store_discount`, `customer_discount` (rupiah bulat >= 0, _Optional_, `null` berarti tanpa diskon).
- `terms_and_condition` (string, _Optional_): kosong berarti memakai terms saat ini.
- `is_final` (boolean, _Optional_): `true` langsung terkunci. Default `false` (bisa diedit satu kali).

Field lain (termasuk `total_amount`, `subtotal`, `no_invoice`) ditolak dengan 400.

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "id": "uuid-invoice",
    "no_invoice": "WAV-20261022-K7M2QX",
    "order_id": "uuid-order",
    "type": "SALE",
    "customer_id": "cust-AAAAA",
    "payment_status": "UNPAID",
    "paid_at": null,
    "customer_name": "Budi",
    "total_amount": 23500000,
    "store_discount": 1000000,
    "customer_discount": 500000,
    "is_final": false,
    "subtotal": 25000000,
    "items": [
      {
        "id": "uuid-item",
        "camera_id": "uuid-kamera",
        "camera_name": "Canon R6",
        "camera_price": 10000000,
        "quantity": 2,
        "restocked": false,
        "sku": "C-1",
        "line_total": 20000000
      }
    ]
  }
}
```

(Field toko, pelanggan, `payment_method`, `ship`, `created_at`, dan `terms_and_condition` ikut ada seperti sebelumnya, dipersingkat di contoh.)

**Error**: 400 (validasi, `DISCOUNT_EXCEEDS_TOTAL`, `AMOUNT_TOO_LARGE`), 401, 403, 404 `CAMERA_NOT_FOUND` (+ `camera_ids`), 503 `STORE_NOT_READY`, 500 `CAMERA_PRICE_INVALID` / `INVOICE_NUMBER_GENERATION_FAILED`.

---

### **GET /admin/invoices**

Daftar invoice, 20 per halaman, terbaru di atas.

#### **Query**

- `search` (maks 100): nama pelanggan, nomor invoice, atau nama kamera (snapshot). Tidak membedakan huruf besar/kecil.
- `created_from`, `created_to` (`YYYY-MM-DD`, WIB, inklusif).
- `is_final` (`true`/`false`), `page` (>= 1, default 1).

Parameter lain ditolak dengan 400.

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "uuid-invoice",
      "no_invoice": "WAV-20261022-K7M2QX",
      "order_id": "uuid-order",
      "type": "SALE",
      "payment_status": "UNPAID",
      "customer_name": "Budi",
      "total_amount": 23500000,
      "is_final": false,
      "subtotal": 25000000,
      "item_count": 2
    }
  ],
  "paging": { "page": 1, "per_page": 20, "total": 45, "total_pages": 3 }
}
```

- `subtotal` dihitung dari item (harga x jumlah), `total_amount` sudah setelah diskon.
- Teks `terms_and_condition` tidak ada di daftar.

**Error**: 400 (validasi atau `INVALID_DATE_RANGE`), 401, 403.

---

### **GET /admin/invoices/:id**

Detail satu invoice (bentuk sama dengan response POST, semua field lengkap).

**Error**: 400 (id bukan UUID), 401, 403, 404 `INVOICE_NOT_FOUND`.

---

### **PATCH /admin/invoices/:id**

Mengedit invoice. Hanya **satu kali**: setelah berhasil, `is_final` menjadi `true` dan terkunci. Request yang gagal tidak menghabiskan jatah.

Body: minimal satu dari `store_name`, `store_address`, `whatsapp_store`, `instagram_store`, `payment_method`, `ship`, `customer_name`, `customer_address`, `customer_whatsapp`, `customer_instagram`, `store_discount`, `customer_discount`, `terms_and_condition`. Aturan nilai sama seperti POST. Field kosong (`""`/`null`) pada kolom opsional disimpan `null`. Item, `total_amount`, `is_final`, dan `no_invoice` tidak bisa diedit.

- Total dihitung ulang dari **subtotal item** dan kedua diskon (diskon yang tidak dikirim memakai nilai lama). `Order.total_amount` ikut diperbarui dalam transaksi yang sama.
- Kalau order sudah punya refund, total baru tidak boleh lebih kecil dari jumlah semua refund.

Response 200: invoice lengkap terbaru, `is_final: true`.

**Error**: 400 (validasi, `DISCOUNT_EXCEEDS_TOTAL`), 401, 403, 404 `INVOICE_NOT_FOUND`, 409 `INVOICE_ALREADY_FINAL`, 409 `{ "errors": "TOTAL_BELOW_REFUNDED", "refunded": 20000000 }`.

---

### **DELETE /admin/invoices/:id**

Menghapus invoice beserta Order dan item-nya (permanen). Boleh untuk invoice final.

**Order yang sudah lunas tidak bisa dihapus** karena stoknya sudah terpotong dan laporan memakainya: ubah dulu ke belum lunas (`PATCH /owner/orders/:id/payment-status`), baru hapus. Untuk membatalkan refund pakai `DELETE /admin/refunds/:id`.

Response 200: `{ "data": { "message": "INVOICE_DELETED" } }`

**Error**: 400, 401, 403, 404 `INVOICE_NOT_FOUND`, 409 `ORDER_ALREADY_PAID`.
