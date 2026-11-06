### **POST /admin/customers**

Admin atau owner menambah pelanggan langsung, tanpa menunggu pelanggan mengisi form. Memerlukan autentikasi. Bisa dipakai **ADMIN dan OWNER**.

#### **Request Body (JSON)**

```json
{
  "name": "Andi",
  "address": "Jl. Melati 2",
  "whatsapp": "08111222333",
  "instagram": "andi.id"
}
```

- `name` (string, **wajib**): maksimum 100 karakter.
- `address` (string, **wajib**): maksimum 500 karakter.
- `whatsapp` (string, **wajib**): 8 sampai 15 digit, boleh diawali `+`, tanpa spasi atau tanda hubung.
- `instagram` (string, _Optional_): maksimum 100 karakter. `""` atau `null` berarti kosong.

Spasi di awal dan akhir dibuang. Field lain (misalnya `id`) ditolak dengan 400, id dibuat otomatis.

Nomor WhatsApp **dinormalkan** sebelum disimpan: `0812...`, `+62812...`, dan `62812...` semuanya menjadi `62812...`. Nomor berawalan `+` dengan kode negara selain 62 disimpan sesuai aslinya tanpa `+`.

---

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "id": "cust-K7M2Q",
    "name": "Andi",
    "whatsapp": "628111222333",
    "instagram": "andi.id",
    "address": "Jl. Melati 2",
    "created_at": "2026-10-30T08:00:00.000Z",
    "order_count": 0,
    "total_spent": 0
  }
}
```

---

#### **Response Error**

1. **400 Bad Request**: validasi gagal (field wajib kosong, format WhatsApp salah, field tidak dikenal, dll).
2. **401 Unauthorized**: lihat `auth-overview.md`.
3. **409 Conflict**: `{ "errors": "WHATSAPP_ALREADY_USED" }`. Nomor itu sudah dimiliki pelanggan lain (dalam bentuk penulisan apa pun).
4. **500 Internal Server Error**: `{ "errors": "CUSTOMER_ID_GENERATION_FAILED" }`. Sangat jarang, kirim ulang request-nya.
