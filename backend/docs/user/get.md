# Get Current User

Mendapatkan informasi user yang sedang login.

## Endpoint

- **Method:** `GET`
- **URL:** `/users/current`
- **Authentication:** Required

## Request Headers

| Header            | Required | Description                                                     |
| ----------------- | -------- | --------------------------------------------------------------- |
| `Authorization`   | No\*     | Access token dengan format `Bearer <access_token>`.             |
| `x-refresh-token` | No\*     | Refresh token untuk mendapatkan session atau access token baru. |

\* Request harus menyertakan kredensial autentikasi sesuai mekanisme yang didukung middleware. Access token dan refresh token dapat digunakan sesuai alur autentikasi yang diimplementasikan.

## Success Response

**Status:** `200 OK`

Mengembalikan informasi user yang sedang login.

```json
{
  "data": {
    "name": "Example User",
    "email": "user@example.com"
  }
}
```

## Error Responses

### 1. Unauthorized

**Status:** `401 Unauthorized`

Terjadi ketika request tidak menyertakan kredensial autentikasi yang diperlukan atau autentikasi gagal karena kredensial tidak valid.

```json
{
  "errors": "UNAUTHORIZED"
}
```

### 2. Session Expired

**Status:** `401 Unauthorized`

Terjadi ketika session tidak dapat dipulihkan, misalnya karena refresh token tidak valid atau sudah tidak dapat digunakan.

```json
{
  "errors": "SESSION_EXPIRED"
}
```

### 3. User Database Mismatch

**Status:** `401 Unauthorized`

Terjadi ketika user berhasil diverifikasi melalui Supabase Auth, tetapi record user yang sesuai tidak ditemukan di database Prisma.

```json
{
  "errors": "USER_DATABASE_MISMATCH"
}
```

## Authentication Flow

1. Client mengirim request ke endpoint `/users/current`.
2. Middleware memvalidasi access token melalui Supabase Auth.
3. Jika access token tidak tersedia atau perlu diperbarui, middleware memproses refresh token sesuai mekanisme yang diimplementasikan.
4. Middleware mencari user yang sesuai di database Prisma.
5. Jika user ditemukan, request diteruskan ke controller.
6. Controller mengembalikan `name` dan `email` user dengan status `200 OK`.
7. Jika autentikasi gagal, session tidak dapat dipulihkan, atau user tidak ditemukan di Prisma, middleware mengembalikan error yang sesuai.

## Example Requests

### Using Access Token

```bash
curl -X GET "http://localhost:3000/users/current" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Using Refresh Token

```bash
curl -X GET "http://localhost:3000/users/current" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

## Notes

- Endpoint ini digunakan untuk mendapatkan informasi user yang sedang login.
- Response hanya mencakup `name` dan `email`.
- User harus memiliki record yang sesuai di database Prisma.
- Jika refresh token digunakan, keberhasilan request bergantung pada mekanisme refresh yang diterapkan middleware.
- Access token dan refresh token merupakan kredensial rahasia dan tidak boleh dibagikan kepada pihak lain.
