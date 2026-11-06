## Laporan penjualan: ringkasan dan tren (OWNER)

Hanya untuk **OWNER** (ADMIN mendapat 403). Memerlukan autentikasi (cookie, lihat `auth-overview.md`).

**Aturan hitung (berlaku di semua laporan)**

- Yang dihitung: order **PAID**, pada tanggal `paid_at` (tanggal lunas), bukan tanggal order. Order belum lunas tidak masuk.
- **Penjualan** = order `SALE`. Omzet memakai `Order.total_amount` (sudah setelah diskon, tanpa ongkir).
- **Modal** = jumlah `camera_modal x quantity` dari item order (snapshot saat order, tidak ikut berubah kalau modal kamera diubah). **Laba** = omzet dikurangi modal.
- **Refund** = order `REFUND` yang sudah PAID, dihitung di tanggal refund-nya, bukan di tanggal penjualan asli. Modal hanya kembali untuk item `restocked = true` (`cost_returned`).
- **Net** = penjualan dikurangi refund. Bisa negatif kalau refund bulan ini lebih besar dari penjualan bulan ini.
- Semua tanggal memakai **WIB**: hari berganti 00.00 WIB, minggu mulai Senin. Semua uang berupa integer rupiah.
- `margin_pct` = laba / omzet x 100 (2 desimal), `null` kalau omzet 0.

---

### **GET /owner/reports/summary**

**Query (opsional):** `from` dan `to` (format `YYYY-MM-DD`, tanggal WIB, keduanya inklusif, harus dikirim berpasangan). Tanpa keduanya = **semua waktu**.

**Response (200)**

```json
{
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-31" },
    "sales":   { "orders": 12, "units": 15, "revenue": 90000000, "cost": 70000000, "profit": 20000000, "margin_pct": 22.22, "avg_order_value": 7500000 },
    "refunds": { "orders": 1, "units": 1, "amount": 5000000, "cost_returned": 4000000 },
    "net":     { "revenue": 85000000, "cost": 66000000, "profit": 19000000, "margin_pct": 22.35 }
  }
}
```

`period` bernilai `null` untuk semua waktu.

**Error:** `400` format tanggal salah, tanggal tidak ada (misal 2026-02-30), `from` setelah `to`, hanya satu dari `from`/`to`, atau parameter lain.

---

### **GET /owner/reports/trend**

Titik per hari, minggu, atau bulan untuk grafik. Periode tanpa penjualan tetap muncul dengan nilai 0.

**Query (semua wajib)**

- `group`: `day`, `week`, atau `month`.
- `from`, `to`: `YYYY-MM-DD` (WIB, inklusif).
- Batas rentang: `day` maks 366 hari, `week` maks 1100 hari, `month` maks 3700 hari. Lebih dari itu `400`.

**Response (200)**

```json
{
  "data": {
    "group": "week",
    "from": "2026-10-01",
    "to": "2026-10-31",
    "data": [
      {
        "date": "2026-09-28",
        "sales":   { "orders": 3, "units": 3, "revenue": 22000000, "cost": 17000000, "profit": 5000000, "margin_pct": 22.73, "avg_order_value": 7333333 },
        "refunds": { "orders": 0, "units": 0, "amount": 0, "cost_returned": 0 },
        "net":     { "revenue": 22000000, "cost": 17000000, "profit": 5000000, "margin_pct": 22.73 }
      }
    ]
  }
}
```

- `date` = awal periode: tanggal itu sendiri (`day`), **hari Senin** (`week`), atau tanggal 1 (`month`). Urut naik.
- Minggu atau bulan di tepi rentang hanya menghitung hari yang berada **di dalam** `from`-`to`. Contoh: `from=2026-10-01` (Kamis) membuat titik pertama bertanggal Senin 2026-09-28, tapi hanya berisi penjualan 1-4 Oktober.
- Jumlah semua titik selalu sama dengan `summary` untuk rentang yang sama.
- Untuk grafik "semua waktu per bulan", frontend mengirim `from` = awal toko berjualan dan `to` = hari ini.

**Error:** `400` (group tidak dikenal, tanggal salah, rentang terlalu panjang, parameter asing).
