### **PUT /admin/customers/:id**

Mengubah data pelanggan. Bisa sebagian: hanya field yang dikirim yang berubah. Memerlukan autentikasi. Bisa dipakai **ADMIN dan OWNER**.

#### **Path Parameter**

- `id` (string): id pelanggan (`cust-...`). Kalau body juga berisi `id`, yang dipakai tetap `id` di URL.

#### **Request Body (JSON)**

```json
{
  "name": "Budi Baru",
  "address": "Jl. Baru 3",
  "whatsapp": "081234567890",
  "instagram": null
}
```

Minimal satu field harus dikirim.

- `name` (string): maksimum 100 karakter, tidak boleh kosong.
- `address` (string): maksimum 500 karakter, tidak boleh kosong.
- `whatsapp` (string): aturan sama dengan saat membuat pelanggan, lalu dinormalkan.
- `instagram` (string atau `null`): `""` atau `null` menghapus isinya.

Field lain ditolak dengan 400.

Order dan invoice yang sudah dibuat **tidak ikut berubah**, karena menyimpan salinan data pelanggan saat order dibuat.

---

#### **Response Sukses (200 OK)**

Bentuknya sama dengan detail pelanggan tanpa `orders`:

```json
{
  "data": {
    "id": "cust-K7M2Q",
    "name": "Budi Baru",
    "whatsapp": "6281234567890",
    "instagram": null,
    "address": "Jl. Baru 3",
    "created_at": "2026-10-03T00:00:00.000Z",
    "order_count": 3,
    "total_spent": 13000000
  }
}
```

---

#### **Response Error**

1. **400 Bad Request**: validasi gagal, body kosong, atau format `id` salah.
2. **401 Unauthorized**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "CUSTOMER_NOT_FOUND" }`
4. **409 Conflict**: `{ "errors": "WHATSAPP_ALREADY_USED" }`. Nomor sudah dimiliki pelanggan lain. Memakai nomor milik pelanggan itu sendiri (dalam bentuk lain) tidak dianggap bentrok.
