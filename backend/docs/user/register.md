# 📝 Dokumentasi API: Registrasi Pengguna

Endpoint ini digunakan untuk mendaftarkan pengguna baru ke dalam sistem backend.

---

## 📌 Informasi Endpoint

- **URL Path:** `/users/register`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Autentikasi:** Tidak Perlu (Public Endpoint)

---

## 📥 Request Body

| Field      | Tipe Data | Wajib? | Keterangan / Aturan Validasi                                       |
| ---------- | --------- | ------ | ------------------------------------------------------------------ |
| `email`    | `string`  | Ya     | Wajib berupa format email yang valid (contoh: `user@example.com`). |
| `password` | `string`  | Ya     | Minimal panjang **8 digit/karakter**.                              |
| `name`     | `string`  | Ya     | Nama lengkap pengguna.                                             |

### Contoh Request Body

```json
{
  "email": "aliyyul@example.com",
  "password": "password123",
  "name": "Aliyyul Munif"
}
```

---

## 📤 Respon Sukses (`201 Created`)

Dikembalikan ketika proses pendaftaran berhasil dibuat di Supabase Auth dan tersinkronisasi ke database Prisma.

```json
{
  "data": {
    "email": "aliyyul@example.com",
    "name": "Aliyyul Munif"
  }
}
```

---

## ❌ Respon Error

### 1. Error Validasi Input Joi (`400 Bad Request`)

Terjadi ketika payload request tidak sesuai dengan aturan schema validasi Joi.

- **Format email salah:**

```json
{
  "errors": "\"email\" must be a valid email"
}
```

- **Password kurang dari 8 karakter:**

```json
{
  "errors": "\"password\" length must be at least 8 characters long"
}
```

- **Field wajib ada yang kosong:**

```json
{
  "errors": "\"name\" is required"
}
```

### 2. Email Sudah Terdaftar (`400 Bad Request`)

Terjadi jika email sudah terdaftar di database Prisma maupun di Supabase Auth.

```json
{
  "errors": "EMAIL_ALREADY_EXIST"
}
```

### 3. Server Error / Internal Response Error (`500 Internal Server Error`)

Terjadi jika terdapat kegagalan tak terduga pada server, koneksi database Prisma, atau service Supabase.

```json
{
  "errors": "INTERNAL_SERVER_ERROR"
}
```
