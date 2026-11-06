### **POST /public/auth/forgot-password**

Dipakai halaman "Lupa password" di frontend. Mengirim email berisi link untuk membuat password baru. Tanpa login (publik), pasang `publicLimiter`. Berlaku untuk OWNER dan ADMIN.

**Alur**

1. User mengisi email di halaman `/auth/forgot-password`, frontend memanggil endpoint ini.
2. Kalau email terdaftar dan akunnya aktif, Supabase mengirim email. Linknya mengarah ke `{FRONTEND_URL}/auth/set-password#access_token=...&type=recovery`.
3. Halaman `/auth/set-password` yang sama dengan undangan admin dipakai lagi: baca `access_token` dari hash, tampilkan form password, panggil `POST /public/auth/set-password` (lihat `public-set-password.md`). Tidak ada endpoint baru untuk langkah ini.
4. Sukses: arahkan ke halaman login.

**Request Body (JSON)**

```json
{ "email": "budi@example.com" }
```

- `email` (string, **wajib**): huruf besar dan spasi di pinggir dinormalkan. Maks 254 karakter.
- Field lain ditolak (400).

**Response (200 OK)**

```json
{ "message": "RESET_EMAIL_SENT_IF_REGISTERED" }
```

Jawabannya **selalu sama**: email terdaftar, tidak terdaftar, akun nonaktif, atau pengiriman email gagal. Ini disengaja supaya orang lain tidak bisa mengecek email siapa yang punya akun. Email dikirim di belakang layar, jadi waktu responsnya pun tidak membedakan. Di frontend tampilkan pesan netral, misalnya "Kalau email terdaftar, link reset sudah dikirim. Cek juga folder spam."

**Error**

| Status | errors | Arti |
|---|---|---|
| 400 | pesan validasi | Email kosong atau formatnya salah |
| 429 | `TOO_MANY_REQUESTS` | Kena `publicLimiter` |

**Catatan**

- Akun nonaktif tidak dikirimi email.
- Supabase membatasi email reset ke alamat yang sama (sekitar 1 kali per 60 detik). Percobaan yang melewati batas itu tidak terlihat oleh user (tetap 200). Beri tahu user untuk menunggu sebentar sebelum mencoba lagi.
- Link reset kedaluwarsa mengikuti pengaturan **OTP expiry** di Supabase. Kalau link sudah mati, user cukup mengulang dari halaman lupa password.
- Redirect URL `{FRONTEND_URL}/auth/set-password` harus ada di daftar **Redirect URLs** Supabase (sudah, karena dipakai undangan admin).
- Template email "Reset Password" di Supabase (Authentication > Email Templates) bisa diubah ke bahasa Indonesia.
