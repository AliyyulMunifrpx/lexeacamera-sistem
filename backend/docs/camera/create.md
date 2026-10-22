# Create Camera

Menambahkan kamera baru ke katalog dengan mengirimkan informasi produk dan mengunggah gambar kamera. Data kamera disimpan di database, sedangkan gambar diproses menjadi format WebP dan diunggah ke Supabase Storage. Gambar pertama yang diunggah otomatis ditetapkan sebagai gambar utama.

## 📌 Informasi Endpoint

- **URL Path:** `/cameras`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Authentication:** Required

## Request Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | No* | Access token dengan format `Bearer <access_token>`. |
| `x-refresh-token` | No* | Refresh token untuk memperbarui session jika access token tidak valid atau tidak tersedia. |

\* Request harus menyertakan kredensial autentikasi sesuai mekanisme yang didukung middleware. Access token atau refresh token digunakan sesuai alur autentikasi yang diimplementasikan.

## Request Body

Request menggunakan `multipart/form-data` karena berisi data teks dan file gambar.

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Nama kamera. Maksimal 100 karakter. |
| `price` | `number` | Yes | Harga kamera. Nilai minimal 0. |
| `condition` | `string` | No | Kondisi kamera: `NEW` atau `SECOND`. Default database: `NEW`. |
| `stock` | `integer` | Yes | Jumlah stok kamera. Nilai minimal 0. |
| `description` | `string` | No | Deskripsi kamera. Maksimal 1000 karakter. |
| `inclusions` | `string` | No | Daftar barang yang disertakan dalam pembelian. Maksimal 1000 karakter. |
| `category_id` | `string` (UUID) | Yes | ID kategori kamera yang sudah tersedia di database. |
| `promo` | `boolean` | No | Menandakan apakah kamera sedang dipromosikan. Default: `false`. |
| `best_selling` | `boolean` | No | Menandakan apakah kamera termasuk produk terlaris. Default: `false`. |
| `images` | `file[]` | Yes | File gambar kamera. Minimal 1 dan maksimal 5 gambar. |
| `marketplace` | `string` (JSON array) | No | Daftar marketplace beserta URL produk. Dikirim sebagai JSON yang diserialisasi menjadi string dalam multipart form-data. |

### Ketentuan Upload Gambar

- Nama field upload harus `images`.
- Maksimal 5 file dalam satu request.
- Format input yang didukung: JPEG, PNG, dan WebP.
- Ukuran maksimum setiap file: 5 MB.
- Gambar diproses menggunakan Sharp dan dikonversi menjadi WebP.
- Ukuran pemrosesan maksimum: 1000 × 1000 piksel, tanpa memperbesar gambar yang lebih kecil.
- Kualitas kompresi WebP: 82.
- Gambar pertama otomatis memiliki `is_primary: true`, sedangkan gambar berikutnya memiliki `is_primary: false`.

### Contoh Request

Contoh pengisian melalui Postman:

1. Pilih method `POST` dan URL `/cameras`.
2. Tambahkan header `Authorization: Bearer <access_token>`.
3. Pilih tab **Body → form-data**.
4. Masukkan field teks berikut.

| Key | Value | Type |
|---|---|---|
| `name` | Canon EOS R50 | Text |
| `price` | `12000000` | Text |
| `condition` | `NEW` | Text |
| `stock` | `3` | Text |
| `description` | Kamera mirrorless untuk fotografi | Text |
| `inclusions` | Body, battery, charger | Text |
| `category_id` | `123e4567-e89b-42d3-a456-426614174000` | Text |
| `promo` | `false` | Text |
| `best_selling` | `false` | Text |
| `images` | Pilih file gambar kamera | File |
| `images` | Pilih file gambar kedua | File |

Untuk beberapa gambar, gunakan key `images` yang sama pada setiap baris file.

Jika ingin menambahkan marketplace, kirim field `marketplace` sebagai string JSON:

```json
[
  {
    "marketplace_id": "123e4567-e89b-42d3-a456-426614174001",
    "product_url": "https://example.com/product/canon-eos-r50"
  }
]
```

`marketplace_id` harus merujuk pada marketplace yang sudah tersedia di database. Jika tidak ada marketplace yang ingin ditambahkan, field ini dapat dihilangkan.

## Success Response

**HTTP Status:** `201 Created`

Contoh struktur respons:

```json
{
  "data": {
    "id": "camera-uuid",
    "name": "Canon EOS R50",
    "price": 12000000,
    "condition": "NEW",
    "stock": 3,
    "description": "Kamera mirrorless untuk fotografi",
    "inclusions": "Body, battery, charger",
    "category_id": "123e4567-e89b-42d3-a456-426614174000",
    "promo": false,
    "best_selling": false,
    "images": [
      {
        "id": "image-uuid",
        "camera_id": "camera-uuid",
        "image_url": "https://your-project.supabase.co/storage/v1/object/public/camera-images/cameras/camera-uuid/image.webp",
        "is_primary": true,
        "created_at": "2026-10-20T05:00:00.000Z"
      }
    ],
    "marketplaceLinks": [],
    "category": {
      "id": "123e4567-e89b-42d3-a456-426614174000"
    }
  }
}
```

Contoh di atas menggambarkan struktur respons. Nilai ID, URL gambar, tanggal, dan properti kategori aktual mengikuti hasil query Prisma dan konfigurasi database.

## Error Responses

### 1. Unauthorized

**HTTP Status:** `401 Unauthorized`

Terjadi ketika access token tidak tersedia atau tidak valid, atau autentikasi gagal.

```json
{
  "errors": "UNAUTHORIZED"
}
```

### 2. User Database Mismatch

**HTTP Status:** `401 Unauthorized`

Terjadi ketika pengguna berhasil diidentifikasi oleh Supabase Auth, tetapi tidak ditemukan di database Prisma.

```json
{
  "errors": "USER_DATABASE_MISMATCH"
}
```

### 3. Camera Images Required

**HTTP Status:** `400 Bad Request`

Terjadi ketika request tidak menyertakan gambar.

```json
{
  "errors": "CAMERA_IMAGES_REQUIRED"
}
```

### 4. Too Many Camera Images

**HTTP Status:** `400 Bad Request`

Terjadi ketika jumlah gambar melebihi batas 5 file, jika error tersebut dipetakan oleh middleware menjadi status `400`.

```json
{
  "errors": "TOO_MANY_CAMERA_IMAGES"
}
```

### 5. Invalid Image Format

**HTTP Status:** `400 Bad Request`

Terjadi ketika format gambar tidak didukung atau validasi format gagal.

```json
{
  "errors": "INVALID_IMAGE_FORMAT"
}
```

### 6. Invalid Image

**HTTP Status:** `400 Bad Request`

Terjadi ketika gambar tidak dapat diproses oleh Sharp, misalnya karena file rusak.

```json
{
  "errors": "INVALID_IMAGE"
}
```

### 7. Invalid Marketplace Data

**HTTP Status:** `400 Bad Request`

Terjadi ketika field `marketplace` dikirim sebagai string JSON yang tidak valid.

```json
{
  "errors": "INVALID_MARKETPLACE_DATA"
}
```

### 8. Validation Error

**HTTP Status:** Mengikuti implementasi validator dan error middleware.

Terjadi ketika field wajib tidak tersedia, tipe data tidak sesuai, UUID tidak valid, harga negatif, atau aturan validasi lain dilanggar.

### 9. User Not Found

**HTTP Status:** `404 Not Found`

Terjadi ketika user terautentikasi tidak ditemukan di database Prisma pada pemeriksaan service.

```json
{
  "errors": "USER_NOT_FOUND"
}
```

### 10. Camera Image Upload Failed

**HTTP Status:** `500 Internal Server Error`

Terjadi ketika Supabase Storage gagal mengunggah gambar.

```json
{
  "errors": "CAMERA_IMAGE_UPLOAD_FAILED"
}
```

### 11. Camera Bucket Not Configured

**HTTP Status:** `500 Internal Server Error`

Terjadi ketika environment variable bucket gambar kamera belum dikonfigurasi.

```json
{
  "errors": "CAMERA_BUCKET_NOT_CONFIGURED"
}
```

### 12. Database Error

**HTTP Status:** Mengikuti implementasi error middleware.

Terjadi ketika penyimpanan data kamera atau relasinya di Prisma gagal. Service mencoba menghapus gambar yang sudah berhasil diunggah untuk mengurangi file yatim di Storage.

### 13. Category not found

**HTTP Status:** `500 Internal Server Error`

Terjadi ketika salah id kategory atau kategory tidak ditemukan.

```json
{
  "errors": "CATEGORY_NOT_FOUND"
}
```
## Alur Proses

1. Middleware autentikasi memvalidasi token dan mencocokkan user Supabase dengan user Prisma.
2. Multer menerima file melalui field `images` dengan batas maksimum 5 file dan ukuran 5 MB per file.
3. Service memvalidasi keberadaan user, gambar, dan data request.
4. Service memproses setiap gambar menggunakan Sharp, memvalidasi format, mengubah orientasi sesuai metadata, mengubah ukuran, dan mengonversi gambar menjadi WebP.
5. Gambar diunggah ke Supabase Storage pada direktori `cameras/{cameraId}/`.
6. Service menghasilkan URL publik untuk setiap gambar dan menetapkan gambar pertama sebagai gambar utama.
7. Prisma menyimpan data kamera, relasi gambar, dan relasi marketplace jika tersedia.
8. Jika proses penyimpanan gagal, service mencoba menghapus file yang sudah diunggah.
9. Jika berhasil, server mengembalikan `201 Created` beserta data kamera, gambar, marketplace, dan kategori.

## Catatan Keamanan

- Endpoint hanya dapat digunakan oleh pengguna yang terautentikasi.
- `category_id` harus merujuk pada kategori yang valid di database.
- `marketplace_id` harus merujuk pada marketplace yang valid jika field marketplace dikirim.
- Jangan mempercayai ekstensi atau MIME type file saja; file tetap harus divalidasi saat diproses.
- Jangan mencatat access token, refresh token, atau kredensial Supabase ke log.
- Batasi ukuran dan jumlah file untuk mengurangi risiko penyalahgunaan resource.
- Pastikan bucket Storage dan akses URL gambar dikonfigurasi sesuai kebutuhan aplikasi.
- Cleanup file setelah kegagalan database bersifat best-effort; kegagalan penghapusan tetap perlu dipantau.
- Penghapusan kamera melalui relasi database tidak otomatis menghapus file fisik dari Supabase Storage kecuali implementasi penghapusan secara eksplisit melakukannya.
