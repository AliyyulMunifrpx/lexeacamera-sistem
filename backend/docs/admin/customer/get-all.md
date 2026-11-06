### **GET /admin/customers**

Daftar pelanggan dengan pencarian dan statistik ringkas. Memerlukan autentikasi (cookie, lihat `auth-overview.md`). Bisa dipakai **ADMIN dan OWNER**.

Tidak ada data modal atau profit. `total_spent` adalah uang masuk dari pelanggan itu.

#### **Query Parameters**

- `search` (string, _Optional_): Maksimum 100 karakter, tidak membedakan huruf besar dan kecil. Dicocokkan sebagian dengan **nama**, **id** (`cust-...`), atau **nomor WhatsApp**. Nomor boleh diketik dalam bentuk `0812...`, `+62812...`, atau `62812...`. Pencarian nomor baru berlaku kalau berisi minimal 3 digit.
- `page` (number, _Optional_): Minimal `1`. Bawaan `1`.

> Parameter lain ditolak dengan 400.

Satu halaman berisi 20 pelanggan, yang terbaru dibuat tampil lebih dulu.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "cust-K7M2Q",
      "name": "Budi Santoso",
      "whatsapp": "6281234567890",
      "instagram": "budi.s",
      "address": "Jl. Mawar 1",
      "created_at": "2026-10-03T00:00:00.000Z",
      "order_count": 3,
      "total_spent": 13000000
    }
  ],
  "paging": { "page": 1, "per_page": 20, "total": 1, "total_pages": 1 }
}
```

- `order_count`: jumlah order penjualan (lunas maupun belum lunas). Order refund tidak dihitung.
- `total_spent`: total order penjualan yang **lunas** dikurangi total refund (rupiah). Order yang belum lunas tidak dihitung.
- `whatsapp` selalu dalam bentuk `62...` (tanpa `+` dan tanpa `0` di depan). Untuk tampilan atau link `wa.me`, pakai apa adanya.
- `instagram` bisa `null`.

---

#### **Response Error**

1. **400 Bad Request**: parameter tidak valid atau tidak dikenal.
2. **401 Unauthorized**: lihat `auth-overview.md`.
