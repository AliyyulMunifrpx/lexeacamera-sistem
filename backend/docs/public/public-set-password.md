### **POST /public/auth/set-password**

Dipakai halaman `/auth/set-password` di frontend, setelah admin klik link undangan dari email. Tanpa login (publik), pasang `publicLimiter`.

**Alur**

1. Admin klik link di email, Supabase memverifikasi lalu mengarahkan ke `{FRONTEND_URL}/auth/set-password#access_token=...&refresh_token=...&type=invite`.
2. Frontend membaca `access_token` dari bagian setelah `#` (`new URLSearchParams(location.hash.slice(1)).get("access_token")`), menampilkan form password, lalu memanggil endpoint ini. Setelah dipanggil, hapus hash dari URL (`history.replaceState`).
3. Sukses: arahkan admin ke halaman login. Email sudah terverifikasi karena ia klik link undangan.

**Request Body (JSON)**

```json
{ "access_token": "eyJhbGciOi...", "password": "Rahasia123" }
```

- `access_token` (string, **wajib**): token dari URL undangan.
- `password` (string, **wajib**): 8 sampai 72 karakter.
- Field lain ditolak (400).

**Response (200 OK)**

```json
{ "message": "PASSWORD_SET" }
```

Token **sekali pakai**: setelah password tersimpan, sesinya dicabut di Supabase, jadi pemanggilan kedua dengan token yang sama dijawab `401 INVALID_TOKEN`.

**Error**

| Status | errors | Arti |
|---|---|---|
| 400 | pesan validasi | Token atau password tidak valid / terlalu pendek |
| 400 | `WEAK_PASSWORD` | Password ditolak aturan Supabase |
| 401 | `INVALID_TOKEN` | Token salah, kedaluwarsa, sudah dipakai, atau akunnya bukan user sistem |
| 403 | `ACCOUNT_SUSPEND` | Akun dinonaktifkan owner |
| 502 | `PASSWORD_UPDATE_FAILED` | Supabase gagal menyimpan password |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | Supabase tidak terjangkau, coba lagi |

Kalau token kedaluwarsa (undangan lebih dari beberapa jam atau sudah dipakai), minta owner menekan **Kirim ulang undangan**.
