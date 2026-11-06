## Laporan penjualan: produk dan kategori (OWNER)

Hanya untuk **OWNER**. Aturan hitung sama dengan `owner-reports-summary-trend.md` (order PAID di tanggal lunas, WIB, refund dihitung di tanggal refund, uang berupa integer rupiah).

**Omzet per produk.** `total_amount` order (sudah setelah diskon) dibagi ke item-itemnya sesuai porsi harga x jumlah (snapshot `camera_price`). Pembagian memakai pembulatan kumulatif, jadi jumlah omzet semua produk **persis sama** dengan omzet di ringkasan. Kalau semua harga item 0, pembagian menurut jumlah unit. Order tanpa item tidak bisa dibagi ke produk, jadi hanya muncul di ringkasan.

**Objek produk dan kategori**

```json
{
  "sales":   { "orders": 3, "units": 4, "revenue": 16500000, "cost": 9000000, "profit": 7500000, "margin_pct": 45.45 },
  "refunds": { "orders": 0, "units": 0, "amount": 0, "cost_returned": 0 },
  "net":     { "revenue": 16500000, "cost": 9000000, "profit": 7500000, "margin_pct": 45.45 }
}
```

- Produk yang hanya punya refund di periode itu (penjualannya di bulan lain) tetap muncul, dengan `sales` 0 dan `net` negatif.
- Kamera yang sudah dihapus tetap ada di laporan dengan `deleted: true`.

---

### **GET /owner/reports/products**

**Query (semua opsional)**

- `from`, `to`: `YYYY-MM-DD` (WIB, inklusif, harus berpasangan). Tanpa keduanya = semua waktu.
- `sort`: `units` (bawaan, "terlaris"), `revenue`, atau `profit`. Semuanya memakai angka **penjualan** (`sales`), diurutkan turun. Seri diurutkan nama.
- `limit`: 1-100, bawaan 20. Untuk overview, kirim `limit=5`.
- `page`: bawaan 1.

**Response (200)**

```json
{
  "data": [
    {
      "id": "uuid-kamera",
      "name": "Canon EOS R50",
      "deleted": false,
      "category": { "id": "uuid", "name": "Body" },
      "sales":   { "orders": 3, "units": 4, "revenue": 16500000, "cost": 9000000, "profit": 7500000, "margin_pct": 45.45 },
      "refunds": { "orders": 0, "units": 0, "amount": 0, "cost_returned": 0 },
      "net":     { "revenue": 16500000, "cost": 9000000, "profit": 7500000, "margin_pct": 45.45 }
    }
  ],
  "paging": { "page": 1, "per_page": 20, "total": 12, "total_pages": 1 },
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "sort": "units"
}
```

`category` bernilai `null` kalau kamera belum punya kategori.

**Error:** `400` (sort/limit/page/tanggal tidak valid, parameter asing).

---

### **GET /owner/reports/categories**

**Query (opsional):** `from`, `to`, `sort` (seperti di atas). Tanpa paging: semua kategori yang punya aktivitas di periode itu.

**Response (200)**

```json
{
  "period": null,
  "sort": "revenue",
  "data": [
    { "id": "uuid", "name": "Body", "products": 2, "sales": { "...": 0 }, "refunds": { "...": 0 }, "net": { "...": 0 } },
    { "id": null, "name": null, "products": 1, "sales": { "...": 0 }, "refunds": { "...": 0 }, "net": { "...": 0 } }
  ]
}
```

- `products` = jumlah produk berbeda yang ada aktivitasnya di periode itu.
- Baris dengan `id: null` = produk tanpa kategori (tampilkan sebagai "Tanpa kategori"). Selalu paling akhir kalau angkanya seri.
- Jumlah semua kategori sama dengan ringkasan.
