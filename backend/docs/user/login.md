# 📝 Dokumentasi API: Login Pengguna

Endpoint ini digunakan untuk mengautentikasi pengguna yang sudah terdaftar. Jika autentikasi di Supabase Auth berhasil, data pengguna akan disinkronkan ke database lokal (Prisma) dan sistem akan mengembalikan token akses (JWT) beserta data profil.

---

## 📌 Informasi Endpoint

- **URL Path:** `/users/login`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Autentikasi:** Tidak Perlu (Public Endpoint)

---

## 📥 Request Body

| Field      | Tipe Data | Wajib? | Keterangan / Aturan Validasi                                       |
| ---------- | --------- | ------ | ------------------------------------------------------------------ |
| `email`    | `string`  | Ya     | Wajib berupa format email yang valid (contoh: `user@example.com`). |
| `password` | `string`  | Ya     | Minimal panjang **8 digit/karakter**.                              |

### Contoh Request Body

```json
{
  "email": "aliyyul@example.com",
  "password": "password123"
}
```

---

## 📤 Respon Sukses (`200 OK`)

Dikembalikan ketika email dan password valid, serta email telah dikonfirmasi/diverifikasi.

```json
{
  "data": {
    "email": "aliyyul@example.com",
    "name": "Aliyyul Munif",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.mc28a...",
    "access_token_expires": 3600
  }
}
```

---

## ❌ Respon Error

### 1. Kredensial Salah (`401 Unauthorized`)

Terjadi ketika email tidak ditemukan atau password yang dimasukkan salah.

```json
{
  "errors": "INCORRECT_EMAIL_OR_PASSWORD"
}
```

### 2. Email Belum Diverifikasi (`403 Forbidden`)

Terjadi jika pengguna mencoba login tetapi belum mengonfirmasi/menerapkan verifikasi email dari Supabase Auth.

```json
{
  "errors": "EMAIL_NOT_VERIVIED"
}
```

### 3. Akun Di-suspend / Banned (`403 Forbidden`)

Terjadi jika akun pengguna telah ditangguhkan atau di-banned di Supabase Auth.

```json
{
  "errors": "ACCOUNT_SUSPEND"
}
```

### 4. Email Conflict (`409 Conflict`)

Terjadi pada kasus anomali data di mana email sudah digunakan oleh akun/ID lain di database lokal.

```json
{
  "errors": "EMAIL_CONFLICT"
}
```

### 5. Error Validasi Input Joi (`400 Bad Request`)

Terjadi jika payload request tidak sesuai dengan format yang ditentukan (misal email tidak valid atau password kependekan).

```json
{
  "errors": "\"email\" must be a valid email"
}
```

### 6. Internal Server Error (`500 Internal Server Error`)

Terjadi jika terdapat kegagalan pada service Supabase atau server internal.

```json
{
  "errors": "SUPABASE_EMAIL_MISSING"
}
```
