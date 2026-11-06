## Laporan customer (OWNER)

Hanya untuk **OWNER**. Aturan hitung sama dengan `owner-reports-summary-trend.md` (order PAID di tanggal lunas, WIB, refund dihitung di tanggal refund). Order yang tidak punya `customer_id` (order lama) tidak masuk daftar customer; jumlahnya dilaporkan di `unassigned` pada endpoint segmen.

Jumlah order dan total belanja untuk halaman **kelola customer** tetap di `GET /admin/customers` (admin dan owner, tanpa modal dan laba). Definisi "lunas" dan refund-nya sama dengan laporan ini: `total_spent` di sana = `net.revenue` customer di sini untuk **semua waktu**. Bedanya, `order_count` di kelola customer menghitung semua order penjualan (lunas dan belum), sedangkan `sales.orders` di sini hanya yang lunas.

---

### **GET /owner/reports/customers**

Peringkat customer, termasuk top customer.

**Query (semua opsional)**

- `from`, `to`: `YYYY-MM-DD` (WIB, inklusif, berpasangan). Tanpa keduanya = semua waktu.
- `sort`: `revenue` (bawaan), `orders`, atau `profit`. Memakai angka **penjualan** (`sales`), turun. Seri diurutkan nama.
- `limit`: 1-100, bawaan 20. Untuk "5 customer teratas" di overview, kirim `limit=5`.
- `page`: bawaan 1.

**Response (200)**

```json
{
  "data": [
    {
      "id": "cust-K7M2Q",
      "name": "Budi Santoso",
      "whatsapp": "6281234567890",
      "instagram": "budi.s",
      "first_order_at": "2026-09-10T02:00:00.000Z",
      "last_order_at": "2026-10-20T03:30:00.000Z",
      "type": "RETURNING",
      "sales":   { "orders": 2, "units": 3, "revenue": 14000000, "cost": 10000000, "profit": 4000000, "margin_pct": 28.57 },
      "refunds": { "orders": 0, "units": 0, "amount": 0, "cost_returned": 0 },
      "net":     { "revenue": 14000000, "cost": 10000000, "profit": 4000000, "margin_pct": 28.57 }
    }
  ],
  "paging": { "page": 1, "per_page": 20, "total": 3, "total_pages": 1 },
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "sort": "revenue"
}
```

- `first_order_at`: order lunas pertama customer **sepanjang waktu** (UTC, ISO). `last_order_at`: order lunas terakhir **di dalam periode**, `null` kalau di periode itu tidak ada penjualan.
- `type`: `NEW` kalau order lunas pertamanya jatuh di dalam periode, `RETURNING` kalau sudah pernah beli lunas sebelum periode. `null` kalau tanpa periode (semua waktu) atau customer itu tidak punya penjualan di periode (misalnya hanya refund).
- Customer yang hanya punya refund di periode itu tetap muncul, dengan `sales` 0 dan `net` negatif.
- Customer tanpa order lunas di periode itu tidak muncul.

**Error:** `400` (sort/limit/page/tanggal tidak valid, parameter asing).

---

### **GET /owner/reports/customers/summary**

Customer baru vs berulang. **`from` dan `to` wajib.** Hanya menghitung penjualan lunas (refund tidak ikut).

**Response (200)**

```json
{
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-31" },
    "active_customers": 2,
    "repeat_rate_pct": 50,
    "new":        { "customers": 1, "orders": 2, "revenue": 900000, "cost": 200000, "profit": 700000 },
    "returning":  { "customers": 1, "orders": 2, "revenue": 500000, "cost": 150000, "profit": 350000 },
    "unassigned": { "customers": 0, "orders": 1, "revenue": 600000, "cost": 100000, "profit": 500000 }
  }
}
```

- `new`: customer yang order lunas pertamanya di periode itu. `returning`: yang sudah pernah beli lunas sebelumnya.
- `active_customers` = `new.customers` + `returning.customers`. `repeat_rate_pct` = berulang / aktif x 100, `null` kalau tidak ada customer aktif.
- `unassigned`: order lunas yang tidak punya customer (data lama). Jumlah `new` + `returning` + `unassigned` selalu sama dengan penjualan di `summary` untuk periode yang sama.

**Error:** `400` (tanggal tidak ada atau tidak lengkap, `from` setelah `to`, parameter asing).
