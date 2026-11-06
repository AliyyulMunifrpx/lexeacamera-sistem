### **Autentikasi (berlaku untuk semua endpoint yang memerlukan autentikasi)**

Token disimpan di **cookie `httpOnly`** (`access_token` dan `refresh_token`) yang dipasang server saat `POST /users/login`. JavaScript di browser **tidak bisa membacanya**, dan frontend **tidak perlu** mengirim header `Authorization`.

#### **Yang harus dilakukan klien**

- Kirim cookie pada setiap request: `withCredentials: true` (axios) atau `credentials: "include"` (fetch). Kalau API diakses lewat proxy same-origin (`/api/...` di Next.js), cookie otomatis ikut.
- Status "sudah login" **tidak bisa** dibaca dari token. Panggil `GET /users/current`.

#### **Cookie**

| Cookie          | Isi           | Umur                                           |
| --------------- | ------------- | ---------------------------------------------- |
| `access_token`  | JWT Supabase  | Mengikuti `expires_in` Supabase (bawaan 1 jam) |
| `refresh_token` | Refresh token | 30 hari, diperpanjang setiap refresh           |

Atribut: `HttpOnly`, `Path=/`, `Secure` (di production), `SameSite=Lax` (bawaan, bisa diatur lewat env `COOKIE_SAMESITE`), `Domain` hanya kalau env `COOKIE_DOMAIN` diisi.

#### **Refresh otomatis**

Kalau `access_token` kedaluwarsa tapi `refresh_token` masih valid, server memperbaruinya **di request yang sama**: request tetap berhasil dan respons membawa `Set-Cookie` baru. Klien tidak perlu melakukan apa pun. Request yang dikirim bersamaan dengan cookie lama berbagi satu hasil refresh.

#### **Pengecekan Origin (perlindungan CSRF)**

Request yang mengubah data (`POST`, `PUT`, `PATCH`, `DELETE`) dan memakai cookie ditolak dengan **403 `FORBIDDEN_ORIGIN`** jika header `Origin`-nya bukan salah satu dari `FRONTEND_URL`. Request tanpa header `Origin` (Postman, curl) tidak terkena aturan ini.

#### **Role**

Setiap user punya `role`: `OWNER` atau `ADMIN`. Endpoint dipisah per role, dan role yang tidak sesuai mendapat **403 `FORBIDDEN`**. Akun yang dinonaktifkan ditolak di semua endpoint dengan 401 `UNAUTHORIZED`.

#### **Response Error dari autentikasi**

| Status | `errors`                   | Arti                                                                 |
| ------ | -------------------------- | -------------------------------------------------------------------- |
| 401    | `UNAUTHORIZED`             | Tidak ada cookie, token tidak valid, atau akun dinonaktifkan         |
| 401    | `SESSION_EXPIRED`          | Access token kedaluwarsa dan refresh gagal. Arahkan ke halaman login |
| 401    | `USER_DATABASE_MISMATCH`   | Akun ada di Supabase tapi tidak terdaftar di sistem                  |
| 403    | `FORBIDDEN`                | Role tidak diizinkan untuk endpoint ini                              |
| 403    | `FORBIDDEN_ORIGIN`         | Origin request tidak diizinkan                                       |
| 503    | `AUTH_SERVICE_UNAVAILABLE` | Supabase sedang bermasalah. **Jangan** logout user, coba lagi nanti  |

> Untuk alat non-browser (Postman, tes), header `Authorization: Bearer <access_token>` dan `x-refresh-token` masih diterima, **hanya jika tidak ada cookie sama sekali**. Cookie selalu diutamakan.
