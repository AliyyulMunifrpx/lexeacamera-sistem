## Kelola admin (OWNER)

Semua endpoint di sini hanya untuk **OWNER** (ADMIN mendapat 403). Hanya akun ber-role ADMIN yang bisa dikelola lewat sini: owner tidak muncul di daftar dan tidak bisa diubah (404 `ADMIN_NOT_FOUND`). Admin tidak dihapus permanen, cukup dinonaktifkan.

**Alur:** owner mengundang admin lewat email, admin klik tautan, membuat password di `/auth/set-password`, lalu login seperti biasa. Kalau `attendance: true`, admin juga tercatat sebagai karyawan; ia membuat PIN absennya sendiri lewat `PUT /users/pin` (owner tidak pernah tahu PIN-nya).

**Objek admin**

```json
{
  "id": "0f6c...-uuid",
  "name": "Sari",
  "email": "sari@example.com",
  "is_active": true,
  "attendance": { "enabled": true, "pin_set": false }
}
```

- `attendance.enabled`: admin ikut daftar absen. `pin_set`: PIN sudah dibuat.
- Admin yang dinonaktifkan: tidak bisa login dan semua sesinya langsung ditolak (role dibaca dari database tiap request), absennya ikut mati.

---

### **POST /owner/admins**

Mengundang admin baru. Email undangan dikirim oleh Supabase.

**Request Body (JSON)**

```json
{ "name": "Sari", "email": "Sari@Example.com", "attendance": true }
```

- `name` (string, **wajib**): maks 100.
- `email` (string, **wajib**): valid, disimpan huruf kecil.
- `attendance` (boolean, opsional, bawaan `true`): harus boolean sungguhan.
- Field lain (misalnya `role`) ditolak 400. Role selalu ADMIN.

Kalau sudah ada karyawan dengan email yang sama dan belum terhubung ke akun, karyawan itu dipakai ulang (PIN dan riwayat absennya tetap).

**Response (201)**: objek admin.

**Error:** `400` validasi, `409 EMAIL_ALREADY_USED`, `429 INVITE_RATE_LIMITED`, `502 INVITE_FAILED`, `500 FRONTEND_URL_NOT_CONFIGURED`. Kalau database gagal setelah undangan terkirim, akun Supabase otomatis dihapus lagi.

---

### **GET /owner/admins**

**Query:** `search` (nama atau email), `status` (`ALL` bawaan, `ACTIVE`, `INACTIVE`), `page` (bawaan 1). Parameter lain ditolak (400). 20 per halaman, urut nama.

**Response (200)**

```json
{
  "data": [ { "id": "...", "name": "Ani", "email": "ani@example.com", "is_active": true, "attendance": { "enabled": true, "pin_set": true } } ],
  "paging": { "page": 1, "per_page": 20, "total": 1, "total_pages": 1 }
}
```

---

### **GET /owner/admins/:id**

Objek admin ditambah `invite_accepted`: `true` (sudah buat password), `false` (belum, tombol kirim ulang), `null` (status tidak bisa dibaca dari Supabase).

**Error:** `400` id bukan UUID, `404 ADMIN_NOT_FOUND`.

---

### **PATCH /owner/admins/:id**

Mengubah sebagian data. Minimal satu field.

**Request Body (JSON)**

```json
{ "name": "Sari Baru", "is_active": true, "attendance": false }
```

- `name`: nama ikut diperbarui di data karyawannya.
- `is_active`: `false` menonaktifkan akun **dan** absennya. Mengaktifkan lagi **tidak** menyalakan absen, kirim `attendance: true` untuk itu.
- `attendance`: `true` menyalakan absen (karyawan dibuat atau diaktifkan lagi; PIN lama tetap berlaku), `false` mematikan absen tanpa menghapus PIN dan riwayat.
- Email tidak bisa diubah dari sini.

**Response (200)**: objek admin.

**Error:** `400` validasi, `404 ADMIN_NOT_FOUND`, `409 ADMIN_INACTIVE` (menyalakan absen untuk admin nonaktif; kirim `is_active: true` bersamaan), `409 EMAIL_ALREADY_USED` (email karyawan lama sudah terhubung ke akun lain).

---

### **POST /owner/admins/:id/resend-invite**

Mengirim ulang undangan ke admin yang belum membuat password. Tanpa body.

**Response (200)**

```json
{ "data": { "id": "...", "email": "sari@example.com", "email_sent": true } }
```

**Error:** `404 ADMIN_NOT_FOUND`, `409 ADMIN_INACTIVE`, `409 INVITE_ALREADY_ACCEPTED`, `429 INVITE_RATE_LIMITED` (batas kirim email Supabase), `502 INVITE_FAILED`.
