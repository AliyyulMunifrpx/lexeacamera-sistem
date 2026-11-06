### **POST /users/logout**

Keluar dari **perangkat ini** saja (sesi di perangkat lain tetap aktif). Berlaku untuk **OWNER dan ADMIN**. Memerlukan autentikasi (cookie, lihat `auth-overview.md`).

Server menghapus kedua cookie (`access_token` dan `refresh_token`) **terlebih dahulu**, lalu mencabut sesi di Supabase. Jadi walaupun pencabutan sesi gagal, cookie di browser tetap terhapus.

---

#### **Response Sukses (200 OK)**

Header (menghapus cookie):

```
Set-Cookie: access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
Set-Cookie: refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
```

Body:

```json
{
  "data": {
    "message": "LOGGED_OUT"
  }
}
```

---

#### **Response Error**

1. **401 Unauthorized**: `UNAUTHORIZED` atau `SESSION_EXPIRED` (lihat `auth-overview.md`). Sesi memang sudah tidak berlaku, arahkan ke halaman login.

2. **500 Internal Server Error**

```json
{
  "errors": "LOGOUT_FAILED"
}
```

Pencabutan sesi di Supabase gagal. **Cookie tetap sudah dihapus**, jadi klien boleh menganggap user sudah keluar.
