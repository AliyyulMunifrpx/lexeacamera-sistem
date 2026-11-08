### **Penjualan (Admin)**

`GET /admin/sales`

Data penjualan untuk admin: omzet, jumlah order, dan unit terjual. **Tanpa modal, laba, dan margin.** Role: ADMIN atau OWNER. Memerlukan autentikasi.

Hanya order **lunas** yang dihitung, berdasarkan **tanggal lunas** (WIB). Definisinya sama dengan laporan owner.

#### **Query**

| Param        | Keterangan                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `period`     | `day` (default), `week`, `month`, `year`, `range`, `all`                                                           |
| `date`       | `YYYY-MM-DD`. Acuan untuk `day`, `week`, `month`, `year`. Default hari ini (WIB). Dilarang untuk `range` dan `all` |
| `from`, `to` | `YYYY-MM-DD`, wajib untuk `range`, `from` tidak boleh setelah `to`. Dilarang untuk periode lain                    |

Contoh:

- `/admin/sales` hari ini
- `/admin/sales?period=day&date=2026-10-10` tanggal tertentu
- `/admin/sales?period=week` pekan ini (Senin sampai Minggu)
- `/admin/sales?period=month&date=2026-09-15` September 2026
- `/admin/sales?period=year&date=2025-01-01` tahun 2025
- `/admin/sales?period=range&from=2026-10-01&to=2026-10-15` rentang tanggal
- `/admin/sales?period=all` sepanjang waktu

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "period": { "type": "week", "from": "2026-10-05", "to": "2026-10-11" },
    "sales": { "orders": 12, "units": 15, "revenue": 48500000 },
    "refunds": { "orders": 1, "units": 1, "amount": 4000000 },
    "net": { "units": 14, "revenue": 44500000 }
  }
}
```

- `period`: rentang yang dipakai (WIB). Untuk `all`, `from` dan `to` bernilai `null`. Rentang `week`, `month`, `year` ditampilkan penuh walau sebagian belum lewat.
- `sales`: penjualan lunas. `orders` = jumlah order, `units` = jumlah barang terjual, `revenue` = total nilai penjualan.
- `refunds`: refund lunas pada periode yang sama (dihitung di tanggal refund dilunasi).
- `net`: `revenue` = omzet bersih (penjualan dikurangi refund), `units` = unit terjual dikurangi unit refund. Bisa negatif kalau refund lebih besar dari penjualan di periode itu.
- Semua uang berupa angka bulat rupiah.

**Error**: 400 (param tidak valid atau kombinasi salah, misalnya `period=range` tanpa `from` dan `to`, atau `date` bersama `period=all`), 401, 403.
