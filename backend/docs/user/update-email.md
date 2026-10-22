# Update Email

Mengajukan perubahan email untuk user yang sedang login.

## Endpoint

- **Method:** `PATCH`
- **URL:** `/users/current/email`
- **Authentication:** Required

## Request Headers

| Header            | Required | Description                                                                                       |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `Authorization`   | No\*     | Access token dengan format `Bearer <access_token>`.                                               |
| `x-refresh-token` | No\*     | Refresh token untuk mendapatkan access token baru jika access token tidak valid atau kedaluwarsa. |

\*Request harus menyertakan kredensial autentikasi yang valid sesuai mekanisme yang didukung middleware. Access token dapat digunakan sendiri jika masih valid, sedangkan refresh token dapat digunakan untuk memperbarui session.

## Request Body

| Field   | Type   | Required | Description                                                      |
| ------- | ------ | -------- | ---------------------------------------------------------------- |
| `email` | String | Yes      | Alamat email baru yang valid dan belum digunakan oleh user lain. |

Example:

```json
{
  "email": "newemail@example.com"
}
```

## Success Response

**Status:** `200 OK`

Permintaan perubahan email berhasil diproses. Email di database Prisma belum langsung berubah sampai proses verifikasi email berhasil dan perubahan disinkronkan.

```json
{
  "data": {
    "message": "EMAIL_VERIFICATION_REQUIRED"
  }
}
```

## Error Responses

### 1. Invalid Request

**Status:** `400 Bad Request`

Terjadi ketika alamat email tidak valid atau request body tidak memenuhi validasi.

```json
{
  "errors": "error joi"
}
```

### 2. Unauthorized

**Status:** `401 Unauthorized`

Terjadi ketika kredensial autentikasi tidak tersedia atau tidak valid.

```json
{
  "errors": "UNAUTHORIZED"
}
```

### 3. Session Expired

**Status:** `401 Unauthorized`

Terjadi ketika session tidak dapat dipulihkan, misalnya karena refresh token tidak valid atau sudah kedaluwarsa.

```json
{
  "errors": "SESSION_EXPIRED"
}
```

### 4. User Database Mismatch

**Status:** `401 Unauthorized`

Terjadi ketika user berhasil diverifikasi melalui Supabase Auth, tetapi record user yang sesuai tidak ditemukan di database Prisma.

```json
{
  "errors": "USER_DATABASE_MISMATCH"
}
```

### 5. Email Already Exists

**Status:** `409 Conflict`

Terjadi ketika alamat email baru sudah digunakan oleh user lain.

```json
{
  "errors": "EMAIL_ALREADY_EXIST"
}
```

### 6. Internal Server Error

**Status:** `500 Internal Server Error`

Terjadi ketika server gagal memproses permintaan perubahan email.

```json
{
  "errors": "INTERNAL_SERVER_ERROR"
}
```

## Authentication Flow

1. Client mengirim request ke endpoint `/users/current/email`.
2. Middleware memvalidasi access token melalui Supabase Auth.
3. Jika access token tidak tersedia atau tidak valid, middleware mencoba memperbarui session menggunakan refresh token jika tersedia.
4. Middleware mencari user yang sesuai di database Prisma.
5. Service memvalidasi alamat email yang diminta.
6. Service memeriksa apakah email baru sudah digunakan oleh user lain.
7. Jika email berbeda dan tersedia, service mengajukan perubahan email melalui Supabase Auth.
8. Setelah permintaan berhasil diproses, client menerima response `200 OK`.
9. Setelah perubahan email dikonfirmasi dan diperbarui di `auth.users`, trigger database menyinkronkan email ke tabel `public."User"`.

## Example Requests

### Using Access Token

```bash
curl -X PATCH "http://localhost:3000/users/current/email" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com"
  }'
```

### Using Refresh Token

```bash
curl -X PATCH "http://localhost:3000/users/current/email" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com"
  }'
```

## Notes

- Endpoint ini mengajukan perubahan email untuk user yang sedang login.
- Email baru harus memiliki format yang valid dan belum digunakan oleh user lain.
- Jika email yang dikirim sama dengan email saat ini, service dapat mengembalikan response tanpa mengajukan perubahan baru. ({message: EMAIL_UNCHANGED})
- Perubahan email mengikuti konfigurasi verifikasi email pada Supabase Auth.
- Email di database Prisma tidak langsung berubah ketika permintaan perubahan email berhasil diproses.
- Trigger database menyinkronkan email setelah perubahan pada `auth.users` berhasil dikonfirmasi.
- Access token dan refresh token merupakan kredensial rahasia dan tidak boleh dibagikan kepada pihak lain.
