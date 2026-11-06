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

### **GET /public/attendance/today**

Status absen **semua karyawan hari ini** (WIB), untuk karyawan yang ingin melihat siapa yang sudah masuk. Tanpa PIN, tetapi hanya dari wifi toko. Yang tampil hanya nama dan jam, tidak ada data kontak.

**Response (200)**

```json
{
  "data": {
    "date": "2026-10-30",
    "summary": { "total": 3, "working": 1, "done": 1, "not_yet": 1 },
    "employees": [
      {
        "id": "0f6c...-uuid",
        "name": "Ani",
        "status": "DONE",
        "check_in_at": "2026-10-30T02:00:00.000Z",
        "check_out_at": "2026-10-30T09:30:00.000Z"
      },
      {
        "id": "1a2b...-uuid",
        "name": "Budi",
        "status": "NOT_YET",
        "check_in_at": null,
        "check_out_at": null
      },
      {
        "id": "3c4d...-uuid",
        "name": "Citra",
        "status": "WORKING",
        "check_in_at": "2026-10-30T02:05:00.000Z",
        "check_out_at": null
      }
    ]
  }
}
```

- `status`: `NOT_YET` (belum absen masuk hari ini), `WORKING` (sudah masuk, belum pulang), `DONE` (sudah pulang).
- Hanya karyawan yang aktif, sudah punya PIN, dan terverifikasi. Urut nama.
- Hari dihitung WIB (00.00 sampai 24.00).

**Error:** `403 NETWORK_NOT_ALLOWED`, `503 STORE_NOT_READY`, `429`.

---

### **POST /public/attendance/history**

Riwayat absen **milik sendiri** per bulan. Memakai PIN (karena itu `POST`), dengan aturan salah PIN yang sama seperti absen: **5 kali salah berturut-turut mengunci 15 menit**. Hanya dari wifi toko.

**Request Body (JSON)**

```json
{ "employee_id": "0f6c...-uuid", "pin": "4821", "month": "2026-10" }
```

- `employee_id` (UUID, **wajib**), `pin` (4 sampai 6 digit, **wajib**).
- `month` (`YYYY-MM`, opsional): bulan WIB. Bawaannya bulan berjalan. Bulan yang belum ada datanya mengembalikan daftar kosong.
- Field lain ditolak dengan 400.

**Response (200)**

```json
{
  "data": {
    "employee": { "id": "0f6c...-uuid", "name": "Ani" },
    "month": "2026-10",
    "summary": { "days": 4, "completed": 2, "missed": 1, "total_minutes": 570 },
    "records": [
      {
        "date": "2026-10-30",
        "status": "WORKING",
        "check_in_at": "2026-10-30T02:00:00.000Z",
        "check_out_at": null,
        "duration_minutes": null
      },
      {
        "date": "2026-10-29",
        "status": "MISSED",
        "check_in_at": "2026-10-29T02:00:00.000Z",
        "check_out_at": null,
        "duration_minutes": null
      },
      {
        "date": "2026-10-28",
        "status": "DONE",
        "check_in_at": "2026-10-28T02:00:00.000Z",
        "check_out_at": "2026-10-28T10:00:00.000Z",
        "duration_minutes": 480
      }
    ]
  }
}
```

- `records` urut dari yang terbaru. `date` adalah tanggal WIB dari absen masuk.
- `status`: `DONE` (masuk dan pulang), `WORKING` (masih berjalan hari ini), `MISSED` (lupa absen pulang; jam pulang bisa diisi owner lewat rekap).
- `summary`: `days` = jumlah hari ada absen, `completed` = jumlah `DONE`, `missed` = jumlah `MISSED`, `total_minutes` = total durasi yang `DONE`.
- Hanya data milik karyawan itu sendiri.

**Error:** `400` (validasi), `401 INVALID_PIN`, `404 EMPLOYEE_NOT_FOUND`, `429 PIN_LOCKED`, `403 NETWORK_NOT_ALLOWED`, `503 STORE_NOT_READY`.

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
