## Absen publik (tanpa login)

Dipakai halaman `/absen`. Semua endpoint di sini **hanya berjalan dari wifi toko** kalau pembatasan jaringan menyala (lihat `owner-attendance.md`), kecuali `my-ip`. Waktu selalu diambil dari **server**, bukan dari HP.

> **Penting untuk frontend:** halaman absen dan tombol "ambil IP saya" harus memanggil **backend langsung** (`NEXT_PUBLIC_API_URL`), bukan lewat proxy `/api` milik Next. Kalau lewat proxy, backend melihat IP server Next, bukan IP perangkat.

Kode error yang berlaku untuk semua endpoint absen di bawah:

- `403 NETWORK_NOT_ALLOWED`: perangkat tidak berada di jaringan toko yang terdaftar (atau tidak ada jaringan aktif).
- `503 STORE_NOT_READY`: data toko belum diisi.
- `429`: dibatasi oleh `publicLimiter`.

---

### **GET /public/my-ip**

Mengembalikan IP perangkat yang memanggil. Dipakai owner untuk tombol "pakai IP saya" saat mendaftarkan wifi toko (lalu hasilnya dikirim ke `POST /owner/attendance-networks`). Tidak perlu login dan tidak dibatasi jaringan.

**Response (200)**

```json
{
  "data": {
    "ip": "203.0.113.7",
    "family": 4,
    "suggested_cidr": "203.0.113.7/32"
  }
}
```

- `family`: `4` atau `6`.
- `suggested_cidr`: IPv4 menjadi `/32`. IPv6 menjadi prefix `/64` (alamat IPv6 perangkat berubah-ubah, jadi satu jaringan didaftarkan sebagai prefix).

**Error:** `500 IP_NOT_DETECTED`.

---

### **GET /public/attendance/employees**

Daftar nama untuk pilihan di halaman absen. Hanya karyawan yang **aktif**, sudah **membuat PIN**, dan email-nya **terverifikasi** (atau admin yang terhubung ke akun). Diurutkan menurut nama.

**Response (200)**

```json
{ "data": [{ "id": "0f6c...-uuid", "name": "Ani" }] }
```

**Error:** `403 NETWORK_NOT_ALLOWED`, `503 STORE_NOT_READY`.

---

### **POST /public/attendance/check-in**

Absen masuk.

**Request Body (JSON)**

```json
{ "employee_id": "0f6c...-uuid", "pin": "4821" }
```

- `employee_id` (UUID, **wajib**)
- `pin` (string, **wajib**): 4 sampai 6 digit angka.

Field lain ditolak dengan 400.

**Response (201 Created)**

```json
{
  "data": {
    "type": "CHECK_IN",
    "employee": { "id": "0f6c...-uuid", "name": "Ani" },
    "at": "2026-10-31T01:02:03.000Z"
  }
}
```

**Aturan**

- **Satu sesi per hari (WIB).** Setelah absen masuk lalu pulang, karyawan tidak bisa absen masuk lagi di hari yang sama. Hari ganti pukul 00.00 WIB. Kalau karyawan salah menekan Pulang, owner membukanya kembali lewat rekap (lihat `owner-attendances.md`).
- Kalau masih ada sesi terbuka dari **hari WIB sebelumnya** (lupa absen pulang), sesi itu otomatis ditandai terlewat (`MISSED`) dan sesi baru dibuat. Hari ganti pukul 00.00 WIB.

**Error**

- `400`: validasi gagal.
- `401 INVALID_PIN`: PIN salah. **5 kali salah berturut-turut mengunci karyawan itu selama 15 menit.**
- `404 EMPLOYEE_NOT_FOUND`: karyawan tidak ada, nonaktif, belum membuat PIN, atau belum terverifikasi (alasannya sengaja tidak dibedakan).
- `409 ALREADY_CHECKED_IN`: masih ada sesi terbuka hari ini (sudah masuk, belum pulang).
- `409 ALREADY_ATTENDED_TODAY`: sudah masuk dan pulang hari ini.
- `409 TOO_SOON`: kurang dari 1 menit sejak absen pulang (hanya mungkin terjadi di sekitar pergantian hari).
- `429 PIN_LOCKED`: terkunci karena PIN salah berulang. PIN yang benar pun ditolak sampai kunci habis.
- `403 NETWORK_NOT_ALLOWED`

---

### **POST /public/attendance/check-out**

Absen pulang. Body sama dengan `check-in`.

**Response (200)**

```json
{
  "data": {
    "type": "CHECK_OUT",
    "employee": { "id": "0f6c...-uuid", "name": "Ani" },
    "at": "2026-10-31T09:30:00.000Z",
    "check_in_at": "2026-10-31T01:02:03.000Z",
    "duration_minutes": 507
  }
}
```

Tidak ada batas minimal jam kerja. Absen pulang boleh kapan saja setelah 1 menit dari absen masuk.

**Error**

- `400`, `401 INVALID_PIN`, `404 EMPLOYEE_NOT_FOUND`, `429 PIN_LOCKED`, `403 NETWORK_NOT_ALLOWED`: sama seperti `check-in`.
- `409 NOT_CHECKED_IN`: tidak ada sesi masuk **hari ini** yang terbuka. (Sesi dari hari sebelumnya tidak bisa ditutup dari sini. Owner memperbaikinya lewat rekap.)
- `409 TOO_SOON`: kurang dari 1 menit sejak absen masuk.
