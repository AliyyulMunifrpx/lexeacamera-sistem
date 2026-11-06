### **POST /users/register**

Mendaftarkan **pemilik (OWNER) pertama**. Endpoint ini hanya berfungsi **sekali**: setelah ada satu user di sistem, semua pendaftaran berikutnya ditolak. Admin tidak mendaftar sendiri, admin dibuat oleh owner. Tidak memerlukan autentikasi.

Setelah berhasil, Supabase mengirim email verifikasi. Link di email mengarah ke `{FRONTEND_URL}/auth/verify-email`. Akun belum bisa login sebelum email diverifikasi.

#### **Request Body (JSON)**

- `name` (string, **Required**): Nama pengguna.
- `email` (string, **Required**): Email yang valid.
- `password` (string, **Required**): Kata sandi.

```json
{
  "name": "Budi",
  "email": "budi@example.com",
  "password": "rahasia123"
}
```

---

#### **Response Sukses (201 Created)**

```json
{
  "data": {
    "email": "budi@example.com",
    "name": "Budi"
  }
}
```

User yang dibuat otomatis berperan **OWNER**.

---

#### **Response Error**

1. **400 Bad Request** (Validasi gagal, atau sudah ada user)

```json
{
  "errors": "USER_ALREADY_EXIST"
}
```

- `USER_ALREADY_EXIST`: owner sudah terdaftar, pendaftaran ditutup.
- `EMAIL_ALREADY_EXIST`: email sudah dipakai di Supabase.
- Pesan validasi lain jika field tidak lengkap atau tidak valid.
