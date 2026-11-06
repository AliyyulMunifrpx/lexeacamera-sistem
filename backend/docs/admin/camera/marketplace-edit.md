### **PUT /admin/cameras/:id/marketplace**

Mengganti **link e-commerce** (marketplace) pada kamera yang sudah ada, untuk **admin**. Memerlukan autentikasi (cookie, lihat `auth-overview.md`). Bisa dipakai **ADMIN dan OWNER**. Hanya link yang diubah: field lain seperti harga atau stok **ditolak**.

Daftar yang dikirim **menggantikan** semua link ke marketplace yang aktif. Link yang tidak ada di daftar akan dihapus. Link ke marketplace yang **nonaktif** tidak terlihat dan **tidak ikut diubah atau dihapus**.

#### **Path Parameters**

- `id` (string UUID, **Required**): Id kamera.

#### **Request Body (JSON)**

- `marketplace` (array, **Required**): Daftar link. Kirim `[]` untuk menghapus semua link. Setiap item:
  - `marketplace_id` (string UUID, **Required**): Id marketplace yang **aktif**. Tidak boleh dobel dalam satu daftar.
  - `product_url` (string, **Required**): URL `http` atau `https`, maksimum 2048 karakter.

```json
{
  "marketplace": [
    {
      "marketplace_id": "e5f6...-uuid",
      "product_url": "https://tokopedia.com/toko/canon-eos-r6"
    }
  ]
}
```

---

#### **Response Sukses (200 OK)**

Daftar link setelah perubahan, diurutkan menurut nama marketplace:

```json
{
  "data": [
    {
      "id": "c3d4...-uuid",
      "camera_id": "0f6c...-uuid",
      "marketplace_id": "e5f6...-uuid",
      "product_url": "https://tokopedia.com/toko/canon-eos-r6",
      "marketplace": {
        "id": "e5f6...-uuid",
        "logo_url": "https://.../logo.png",
        "name": "Tokopedia",
        "is_active": true
      }
    }
  ]
}
```

Perubahan dilakukan sekaligus: kalau ada yang gagal, link lama tetap seperti semula.

---

#### **Response Error**

1. **400 Bad Request** (Validasi gagal)

```json
{
  "errors": "\"marketplace\" is required" // atau pesan validasi lain
}
```

Muncul jika `marketplace` tidak dikirim, `marketplace_id` dobel atau bukan UUID, `product_url` bukan `http`/`https`, atau ada field lain di body.

2. **404 Not Found**

- `CAMERA_NOT_FOUND`: kamera tidak ada atau sudah dihapus.
- `MARKETPLACE_NOT_FOUND`: ada `marketplace_id` yang tidak ada atau nonaktif.

3. **409 Conflict**

```json
{
  "errors": "CAMERA_UPDATE_CONFLICT"
}
```

Terjadi perubahan bersamaan pada link yang sama. Ulangi request.

4. **401 Unauthorized** dan **403 Forbidden**. Lihat `auth-overview.md`.
