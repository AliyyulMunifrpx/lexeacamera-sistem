### **GET /users/current**

Mengambil profil user yang sedang login. Berlaku untuk **OWNER dan ADMIN**. Memerlukan autentikasi (cookie, lihat `auth-overview.md`).

Frontend memakai endpoint ini untuk mengetahui **apakah user sudah login** dan **role-nya**, karena token tidak bisa dibaca dari JavaScript.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "email": "budi@example.com",
    "name": "Budi",
    "role": "ADMIN",
    "attendance": { "enabled": true, "pin_set": false }
  }
}
```

- `attendance.enabled`: `true` kalau akun ini juga karyawan yang boleh absen (diatur owner di `/owner/admins`). OWNER selalu `false`.
- `attendance.pin_set`: sudah membuat PIN atau belum. Kalau `enabled: true` dan `pin_set: false`, frontend menampilkan ajakan membuat PIN (`PUT /users/pin`).

- Kalau access token sudah kedaluwarsa tapi refresh token masih valid, respons ini juga membawa `Set-Cookie` baru (refresh otomatis).

---

#### **Response Error**

1. **401 Unauthorized**: `UNAUTHORIZED`, `SESSION_EXPIRED`, atau `USER_DATABASE_MISMATCH` (lihat tabel di `auth-overview.md`). Frontend mengarahkan ke halaman login.

2. **404 Not Found**

```json
{
  "errors": "USER_NOT_FOUND"
}
```

3. **503 Service Unavailable**: `AUTH_SERVICE_UNAVAILABLE`. Jangan logout user, coba lagi nanti.
