### **Dashboard**

Ringkasan untuk halaman utama. Dua endpoint, isinya disesuaikan dengan role. Memerlukan autentikasi. Tanpa parameter query.

| Endpoint               | Role             | Beda                                                               |
| ---------------------- | ---------------- | ------------------------------------------------------------------ |
| `GET /owner/dashboard` | OWNER            | Ada `revenue_this_month`, dan data kamera memuat `capital` (modal) |
| `GET /admin/dashboard` | ADMIN atau OWNER | **Tanpa** pendapatan dan **tanpa** modal di mana pun               |

Selebihnya isinya sama persis. Semua uang berupa angka bulat rupiah. Hari dan bulan dihitung menurut WIB.

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "summary": {
      "cameras": { "total": 42, "out_of_stock": 3 },
      "invoices": {
        "total": 120,
        "pending": 5,
        "final": 115,
        "today": 4,
        "unpaid": 8,
        "paid": 112
      },
      "revenue_this_month": 48500000
    },
    "best_selling_cameras": {
      "total": 6,
      "items": [
        {
          "id": "...",
          "name": "Canon R6",
          "stock": 2,
          "images": [],
          "category": {}
        }
      ]
    },
    "promo_cameras": { "total": 2, "items": [] },
    "low_stock_cameras": { "total": 4, "items": [] },
    "pending_invoices": {
      "total": 5,
      "items": [
        {
          "id": "...",
          "no_invoice": "WAV-20261030-K7M2QX",
          "customer_name": "Budi",
          "total_amount": 23500000,
          "subtotal": 25000000,
          "item_count": 2,
          "type": "SALE",
          "payment_status": "UNPAID",
          "is_final": false,
          "created_at": "..."
        }
      ]
    },
    "unpaid_invoices": { "total": 8, "items": [] },
    "charts": {
      "sales_trend": [
        { "date": "2026-11-01", "orders": 2, "revenue": 3500000 },
        { "date": "2026-11-02", "orders": 0, "revenue": 0 }
      ],
      "top_products": [{ "camera_id": "uuid", "name": "Canon R6", "units": 5 }]
    }
  }
}
```

- `summary.cameras`: hanya kamera yang belum dihapus. `out_of_stock` = stok 0.
- `summary.invoices`: hanya **penjualan** (invoice refund tidak dihitung). `pending` = belum final (masih bisa diedit sekali), `unpaid`/`paid` = status bayar, `today` = dibuat hari ini.
- `summary.revenue_this_month` (**hanya owner**): penjualan lunas dikurangi refund lunas, menurut **tanggal lunas** bulan ini. Sama dengan definisi di laporan owner. Order belum lunas tidak dihitung.
- `best_selling_cameras`, `promo_cameras`, `low_stock_cameras`: maksimal **3** item terbaru, `total` = jumlah seluruhnya. Stok menipis = stok 3 atau kurang, urut paling kritis (stok 0) dulu. Data kamera sama bentuknya dengan `GET /cameras`; `capital` hanya ada di versi owner.
- `pending_invoices` dan `unpaid_invoices`: maksimal 3 baris terbaru, bentuk sama dengan baris `GET /invoices` (tanpa teks terms, tanpa modal/laba).

#### **Data grafik (`charts`)**

- `sales_trend`: satu titik per hari dari tanggal 1 sampai **hari ini** (WIB) bulan berjalan, urut tanggal. Hari tanpa penjualan tetap ada dengan nilai 0, jadi grafik tidak bolong. Cocok untuk grafik garis atau batang.
  - `date`: `YYYY-MM-DD` (hari WIB).
  - `orders`: jumlah penjualan yang **lunas** pada hari itu (menurut tanggal lunas). Refund tidak dihitung.
  - `revenue` (**hanya owner**): pendapatan bersih hari itu, yaitu penjualan lunas dikurangi refund lunas. Refund mengurangi pendapatan di hari refund dilunasi, jadi satu hari bisa bernilai negatif. Jumlah semua `revenue` sama dengan `summary.revenue_this_month`.
- `top_products`: maksimal **5** kamera paling laku bulan ini, urut unit terbanyak (seri diurutkan nama). `units` = unit terjual (lunas) dikurangi unit refund; produk dengan hasil 0 atau minus tidak ditampilkan. Admin dan owner mendapat data yang sama (hanya jumlah unit, tanpa nominal). Cocok untuk grafik batang horizontal.
- Versi admin tidak membaca nominal uang sama sekali untuk grafik ini.

#### **Perubahan dari versi lama**

- `revenue_this_month` sekarang **angka**, bukan string, dan dihitung dari status lunas (bukan dari invoice final).
- Invoice refund tidak ikut hitungan.
- Ditambah `invoices.unpaid`, `invoices.paid`, dan daftar `unpaid_invoices`.
- Ditambah `charts` (`sales_trend` dan `top_products`).

**Error**: 401, 403 (role tidak sesuai).
