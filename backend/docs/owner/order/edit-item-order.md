### **PUT /owner/orders/:id/items**

Mengubah **isi pesanan** (jumlah, hapus, atau tambah barang) selama order masih **belum lunas**. Memerlukan autentikasi dan role **OWNER**. Berguna kalau stok kurang saat akan dilunasi, atau pelanggan mengurangi pesanan.

Daftar yang dikirim **menggantikan** isi pesanan: barang yang tidak ada di daftar dihapus, barang baru ditambahkan, barang yang sudah ada diubah jumlahnya. Seluruh perubahan dilakukan dalam satu transaksi dengan kunci pada order, jadi kalau ada yang gagal, pesanan tetap seperti semula.

#### **Path Parameter**

- `id` (string UUID, **Required**): Id order.

#### **Request Body (JSON)**

```json
{
  "items": [
    { "camera_id": "0f6c...-uuid", "quantity": 3 },
    { "camera_id": "e5f6...-uuid", "quantity": 1 }
  ]
}
```

- `items` (array, **Required**): 1 sampai 50 barang. `camera_id` tidak boleh dobel.
  - `camera_id` (string UUID, **Required**)
  - `quantity` (integer, **Required**): 1 sampai 1000.
- Field lain ditolak dengan 400. Untuk membatalkan seluruh pesanan, hapus invoice-nya, bukan mengirim daftar kosong.

#### **Aturan**

- **Harga:** barang yang **sudah ada** di order tetap memakai harga dan modal saat order dibuat. Barang yang **baru ditambahkan** memakai harga dan modal kamera saat ini.
- **Total:** dihitung ulang dari barang, dikurangi diskon toko dan diskon pelanggan yang tercatat di invoice. `total_amount` di order **dan** invoice ikut berubah.
- **Invoice final:** tetap boleh, karena isi invoice mengikuti isi pesanan. Status final tidak berubah. File PDF yang sudah pernah dikirim ke pelanggan **tidak** ikut berubah, jadi unduh dan kirim ulang.
- **Stok tidak berubah** di sini. Stok dicek dan dipotong saat order dilunasi (`PATCH /owner/orders/:id/payment-status`).
- Hanya order `SALE` yang **belum lunas**. Order yang sudah lunas harus dibatalkan ke belum lunas dulu.

#### **Response Sukses (200 OK)**

Detail order setelah perubahan, bentuknya sama dengan `GET /owner/orders/:id`.

---

#### **Response Error**

1. **400 Bad Request**: validasi gagal, atau `DISCOUNT_EXCEEDS_TOTAL` (diskon di invoice lebih besar dari total baru; kurangi diskon lewat edit invoice atau ubah isi pesanan).
2. **404 Not Found**: `ORDER_NOT_FOUND`, atau `CAMERA_NOT_FOUND` (ada barang baru yang tidak ada atau sudah dihapus; detail di `camera_ids`).
3. **409 Conflict**: `ORDER_ALREADY_PAID` (order sudah lunas), `ORDER_NOT_SALE` (order refund).
4. **401 Unauthorized** dan **403 Forbidden**. Lihat `auth-overview.md`.
