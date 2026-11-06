### **POST /users/login**

Masuk dengan email dan kata sandi. Berlaku untuk **OWNER dan ADMIN**. Tidak memerlukan autentikasi.

Token **tidak** dikembalikan di body. Server memasang dua cookie `httpOnly` (`access_token` dan `refresh_token`) lewat header `Set-Cookie`. Lihat `auth-overview.md` untuk detail cookie. Klien harus mengirim request dengan `withCredentials: true` (atau lewat proxy same-origin).

Hanya akun yang terdaftar di sistem (owner, atau admin yang diundang owner) yang bisa masuk. Login tidak pernah membuat user baru.

#### **Request Body (JSON)**

- `email` (string, **Required**): Email akun.
- `password` (string, **Required**): Kata sandi.

```json
{
  "email": "budi@example.com",
  "password": "rahasia123"
}
```

---

#### **Response Sukses (200 OK)**

Header:

```
Set-Cookie: access_token=<jwt>; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600
Set-Cookie: refresh_token=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
```

Body:

```json
{
  "data": {
    "email": "budi@example.com",
    "name": "Budi",
    "role": "OWNER"
  }
}
```

- `role`: `OWNER` atau `ADMIN`. Frontend memakainya untuk menentukan dashboard yang ditampilkan.
- Kalau email akun diubah lewat verifikasi Supabase, email di database disinkronkan saat login ini.

---

#### **Response Error**

Pada semua error di bawah, **tidak ada cookie yang dipasang**.

1. **400 Bad Request** (Validasi gagal): `email` atau `password` tidak dikirim atau tidak valid.

2. **401 Unauthorized**

```json
{
  "errors": "INCORRECT_EMAIL_OR_PASSWORD"
}
```

Email atau kata sandi salah. Pesan yang sama juga dikembalikan untuk akun Supabase yang tidak terdaftar di sistem (supaya tidak membocorkan akun mana yang ada).

3. **403 Forbidden**

- `EMAIL_NOT_VERIVIED`: Email belum diverifikasi.
- `ACCOUNT_SUSPEND`: Akun dinonaktifkan (oleh owner) atau diblokir.

4. **409 Conflict**

```json
{
  "errors": "EMAIL_CONFLICT"
}
```

Email baru dari Supabase sudah dipakai user lain di database.

5. **500 Internal Server Error**: Kesalahan dari Supabase atau server.
