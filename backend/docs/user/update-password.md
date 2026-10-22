# Update Password

Mengubah password akun pengguna yang sedang login. Pengguna wajib memasukkan password saat ini sebagai verifikasi sebelum password baru diterapkan.

## 📌 Informasi Endpoint

- **URL Path:** `/users/register`
- **Method:** `PATCH`
- **Content-Type:** `application/json`
- **Authentication:** Required

## Request Headers

| Header            | Required | Description                                                     |
| ----------------- | -------- | --------------------------------------------------------------- |
| `Authorization`   | No\*     | Access token dengan format `Bearer <access_token>`.             |
| `x-refresh-token` | No\*     | Refresh token untuk mendapatkan session atau access token baru. |

\* Request harus menyertakan kredensial autentikasi sesuai mekanisme yang didukung middleware. Access token dan refresh token dapat digunakan sesuai alur autentikasi yang diimplementasikan.

## Request Body

| Field              | Type     | Required | Description                                            |
| ------------------ | -------- | -------- | ------------------------------------------------------ |
| `current_password` | `string` | Yes      | Password pengguna saat ini untuk verifikasi identitas. |
| `new_password`     | `string` | Yes      | Password baru yang ingin digunakan.                    |

Contoh:

```json
{
  "current_password": "passwordlama123",
  "new_password": "passwordbaru456"
}
```

## Success Response

**HTTP Status:** `200 OK`

```json
{
  "message": "PASSWORD_UPDATED"
}
```

Password baru dapat digunakan untuk login berikutnya.

## Error Responses

### 1. Unauthorized

**HTTP Status:** `401 Unauthorized`

Terjadi ketika access token tidak tersedia, tidak valid, atau autentikasi gagal.

Contoh:

```json
{
  "errors": "UNAUTHORIZED"
}
```

Nama error aktual mengikuti implementasi middleware autentikasi.

### 2. User Not Found

**HTTP Status:** `404 Not Found`

Terjadi ketika data pengguna tidak ditemukan di database aplikasi.

```json
{
  "errors": "USER_NOT_FOUND"
}
```

### 3. Current Password Invalid

**HTTP Status:** `400 Bad Request`

Terjadi ketika password saat ini tidak sesuai dengan password akun di Supabase Auth.

```json
{
  "errors": "CURRENT_PASSWORD_INVALID"
}
```

### 4. Password Update Failed

**HTTP Status:** `400 Bad Request`

Terjadi ketika Supabase gagal memperbarui password baru.

```json
{
  "errors": "PASSWORD_UPDATE_FAILED"
}
```

### 5. Validation Error

**HTTP Status:** Mengikuti implementasi validasi aplikasi.

Terjadi ketika request body tidak memenuhi aturan validasi, misalnya field wajib tidak tersedia atau format password tidak sesuai.

Bentuk respons mengikuti format error validator yang digunakan aplikasi.

## Alur Proses

1. Middleware memvalidasi access token dan mengidentifikasi pengguna yang sedang login.
2. Backend mengambil data pengguna dari database.
3. Backend memverifikasi password saat ini menggunakan Supabase Auth.
4. Jika password saat ini salah, proses dihentikan dan mengembalikan `CURRENT_PASSWORD_INVALID`.
5. Jika verifikasi berhasil, backend memperbarui password melalui Supabase Admin API.
6. Jika pembaruan gagal, backend mengembalikan `PASSWORD_UPDATE_FAILED`.
7. Jika pembaruan berhasil, backend mengembalikan `PASSWORD_UPDATED`.

## Catatan Keamanan

- Endpoint hanya dapat digunakan oleh pengguna yang telah terautentikasi.
- ID pengguna diambil dari hasil autentikasi server, bukan dari request body.
- Password saat ini harus diverifikasi sebelum password baru diperbarui.
- Service-role key Supabase hanya boleh digunakan di backend.
- Password tidak boleh dicatat ke log.
- Pengguna perlu mengikuti kebijakan password yang dikonfigurasi di Supabase.
