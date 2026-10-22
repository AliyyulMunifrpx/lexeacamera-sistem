## **Banner**

Banner adalah gambar yang ditampilkan di halaman utama aplikasi (misalnya infografis atau promo). Daftar banner bersifat **publik**, sedangkan mengelola banner (tambah, ganti gambar, hapus) hanya untuk admin.

| Method   | Endpoint       | Autentikasi          | Fungsi                         |
| -------- | -------------- | -------------------- | ------------------------------ |
| `GET`    | `/banners`     | Tidak perlu (publik) | Daftar banner, terbaru di atas |
| `GET`    | `/banners/:id` | Bearer Token         | Detail satu banner             |
| `POST`   | `/banners`     | Bearer Token         | Menambah banner                |
| `PATCH`  | `/banners/:id` | Bearer Token         | Mengganti gambar banner        |
| `DELETE` | `/banners/:id` | Bearer Token         | Menghapus banner               |

---

### **GET /banners**

Mengambil daftar banner untuk ditampilkan di halaman utama. **Endpoint publik, tidak memerlukan autentikasi.** Banner diurutkan dari yang paling baru dibuat (`created_at` terbaru di atas), dan dibatasi maksimal **50** banner. Respons memakai header `Cache-Control: public, max-age=60`.

#### **Parameters**

Tidak ada. Query string apa pun diabaikan (termasuk upaya menaikkan batas jumlah data).

---

#### **Response Sukses (200 OK)**

```json
{
  "data": [
    {
      "id": "6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21",
      "banner_url": "https://xyz.supabase.co/storage/v1/object/public/banner-images/banners/6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21/2b7c1a90-55d4-4c1e-8f3a-9d6e4a7b1c02.webp",
      "created_at": "2026-10-21T09:30:12.481Z"
    },
    {
      "id": "c41d9e07-8b52-4f3a-b6d1-72a0e5f9c384",
      "banner_url": "https://xyz.supabase.co/storage/v1/object/public/banner-images/banners/c41d9e07-8b52-4f3a-b6d1-72a0e5f9c384/9e3f6b21-7a08-4d5c-a1b4-3c8d2e0f5a67.webp",
      "created_at": "2026-10-20T14:05:47.120Z"
    }
  ]
}
```

Jika belum ada banner, `data` berupa array kosong (`[]`).

---

### **GET /banners/:id**

Mengambil detail satu banner. Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik banner.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21",
    "banner_url": "https://xyz.supabase.co/storage/v1/object/public/banner-images/banners/6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21/2b7c1a90-55d4-4c1e-8f3a-9d6e4a7b1c02.webp",
    "created_at": "2026-10-21T09:30:12.481Z"
  }
}
```

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Banner tidak ditemukan)

```json
{
  "errors": "BANNER_NOT_FOUND"
}
```

3. **400 Bad Request** (`id` bukan UUID yang valid)

```json
{
  "errors": "\"id\" must be a valid GUID" // pesan validasi Joi
}
```

---

### **POST /banners**

Menambahkan banner baru dengan mengunggah satu gambar. Memerlukan autentikasi (_Bearer Token_).

Gambar otomatis diproses sebelum disimpan: dikonversi ke format **WebP** dan diperkecil agar muat di dalam **1600 × 1600 px** dengan rasio asli dipertahankan (tidak dipotong). Gambar yang lebih kecil dari itu **tidak** diperbesar.

#### **Request Body (Multipart / Form-Data)**

- `banner` (file, **Required**): Berkas gambar banner. Format yang didukung: PNG, JPEG, WEBP. Ukuran maksimum 5 MB, hanya boleh satu file.

Field teks lain yang dikirim (misalnya `id`, `banner_url`, atau `created_at`) diabaikan. Semua nilai itu dibuat oleh server.

---

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "id": "6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21",
    "banner_url": "https://xyz.supabase.co/storage/v1/object/public/banner-images/banners/6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21/2b7c1a90-55d4-4c1e-8f3a-9d6e4a7b1c02.webp",
    "created_at": "2026-10-21T09:30:12.481Z"
  }
}
```

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **400 Bad Request** (Gambar tidak dikirim, format bukan PNG/JPEG/WEBP, file rusak, melebihi 5 MB, atau nama field / jumlah file salah)

```json
{
  "errors": "BANNER_IMAGE_REQUIRED" // atau "INVALID_IMAGE_FORMAT", "INVALID_IMAGE", "IMAGE_TOO_LARGE", "INVALID_IMAGE_FIELD"
}
```

| Kode                    | Penyebab                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `BANNER_IMAGE_REQUIRED` | Tidak ada file di field `banner`.                                                                 |
| `INVALID_IMAGE_FORMAT`  | Format file bukan PNG, JPEG, atau WEBP (dicek dari isi file, bukan hanya dari `Content-Type`).    |
| `INVALID_IMAGE`         | File tidak bisa dibaca sebagai gambar (rusak, terpotong, atau resolusinya melebihi batas proses). |
| `IMAGE_TOO_LARGE`       | Ukuran file lebih dari 5 MB.                                                                      |
| `INVALID_IMAGE_FIELD`   | Nama field bukan `banner`, atau lebih dari satu file dikirim.                                     |

3. **500 Internal Server Error** (Kegagalan di sisi server)

```json
{
  "errors": "BANNER_UPLOAD_FAILED" // atau "BANNER_BUCKET_NOT_CONFIGURED"
}
```

---

### **PATCH /banners/:id**

Mengganti gambar sebuah banner. Memerlukan autentikasi (_Bearer Token_). Gambar baru diproses dengan aturan yang sama seperti `POST /banners`. Setelah berhasil, gambar lama otomatis dihapus dari penyimpanan, dan `created_at` **tidak berubah**, sehingga posisi banner di daftar tetap sama.

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik banner yang gambarnya akan diganti.

#### **Request Body (Multipart / Form-Data)**

- `banner` (file, **Required**): Berkas gambar pengganti. Format yang didukung: PNG, JPEG, WEBP. Ukuran maksimum 5 MB, hanya boleh satu file.

Field teks lain (termasuk `id`, `banner_url`, dan `created_at`) diabaikan. `id` selalu diambil dari URL.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "id": "6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21",
    "banner_url": "https://xyz.supabase.co/storage/v1/object/public/banner-images/banners/6f0b8c52-3a1e-4d77-9a42-0d1f5b8c9e21/e8a4d3c7-1f90-4b26-8c5d-6a2b9f0e7d13.webp",
    "created_at": "2026-10-21T09:30:12.481Z"
  }
}
```

`banner_url` berubah menjadi URL gambar yang baru.

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Banner tidak ditemukan)

```json
{
  "errors": "BANNER_NOT_FOUND"
}
```

3. **400 Bad Request** (`id` bukan UUID valid, atau masalah pada gambar seperti di `POST /banners`)

```json
{
  "errors": "BANNER_IMAGE_REQUIRED" // atau "INVALID_IMAGE_FORMAT", "INVALID_IMAGE", "IMAGE_TOO_LARGE", "INVALID_IMAGE_FIELD"
}
```

Jika `id` bukan UUID valid, `errors` berisi pesan validasi Joi, sama seperti pada `GET /banners/:id`. Jika request gagal, banner dan gambar lamanya tidak berubah.

4. **500 Internal Server Error** (Kegagalan di sisi server)

```json
{
  "errors": "BANNER_UPLOAD_FAILED" // atau "BANNER_BUCKET_NOT_CONFIGURED"
}
```

---

### **DELETE /banners/:id**

Menghapus banner beserta seluruh file gambarnya di penyimpanan. Memerlukan autentikasi (_Bearer Token_). Setelah dihapus, banner langsung hilang dari `GET /banners`.

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik banner yang akan dihapus.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "message": "BANNER_DELETED"
  }
}
```

Jika pembersihan file di penyimpanan gagal setelah data banner terhapus, request tetap berhasil (200) dan kegagalannya hanya dicatat di log server.

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Banner tidak ditemukan, termasuk jika sudah dihapus sebelumnya)

```json
{
  "errors": "BANNER_NOT_FOUND"
}
```

3. **400 Bad Request** (`id` bukan UUID yang valid)

```json
{
  "errors": "\"id\" must be a valid GUID" // pesan validasi Joi
}
```

4. **500 Internal Server Error** (Konfigurasi bucket belum diatur)

```json
{
  "errors": "BANNER_BUCKET_NOT_CONFIGURED"
}
```
