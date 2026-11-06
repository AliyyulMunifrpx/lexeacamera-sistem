### **PUT /users/pin**

Admin yang absennya sudah dinyalakan owner membuat atau mengganti PIN absen sendiri. Memerlukan autentikasi (cookie). Untuk memastikan yang mengganti benar pemilik akun, **password akun wajib dikirim**.

**Request Body (JSON)**

```json
{ "pin": "4821", "current_password": "PasswordAkun123" }
```

- `pin` (string, **wajib**): 4 sampai 6 digit angka. Harus string, bukan number.
- `current_password` (string, **wajib**): password login akun ini.
- Field lain diabaikan. PIN selalu milik user yang sedang login.

**Response (200 OK)**

```json
{ "message": "PIN_UPDATED" }
```

PIN disimpan sebagai hash. Hitungan salah PIN dan kunci 15 menit (kalau ada) ikut direset.

**Error**

| Status | errors | Arti |
|---|---|---|
| 400 | pesan validasi | PIN bukan 4-6 digit, field wajib kosong |
| 400 | `CURRENT_PASSWORD_INVALID` | Password salah |
| 409 | `ATTENDANCE_NOT_ENABLED` | Absen belum dinyalakan owner untuk akun ini (OWNER selalu begini) |
| 401 | (lihat `auth-overview.md`) | Belum login |

Pasang rate limiter di route ini (sama seperti `PUT /users/password`), karena ia memverifikasi password.
