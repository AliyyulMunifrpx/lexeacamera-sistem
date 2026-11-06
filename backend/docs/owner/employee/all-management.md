## Kelola karyawan (OWNER)

Semua endpoint di sini memerlukan autentikasi (cookie, lihat `auth-overview.md`) dan role **OWNER**. ADMIN mendapat 403. Karyawan **tidak punya akun login**: mereka hanya memverifikasi email lalu membuat PIN sendiri (owner tidak pernah tahu PIN-nya). Karyawan tidak dihapus permanen, hanya dinonaktifkan, supaya riwayat absen tetap ada.

**Objek karyawan**

```json
{
  "id": "0f6c...-uuid",
  "name": "Ani",
  "email": "ani@example.com",
  "is_active": true,
  "email_verified_at": "2026-10-31T01:00:00.000Z",
  "verify_sent_at": "2026-10-30T01:00:00.000Z",
  "created_at": "2026-10-30T01:00:00.000Z",
  "pin_set": true,
  "linked_to_user": false,
  "status": "READY"
}
```

- `status`: `PENDING` (belum membuat PIN atau belum verifikasi), `READY` (bisa absen), `INACTIVE` (dinonaktifkan).
- `linked_to_user`: `true` untuk admin yang juga absen (email-nya milik akun admin, tidak bisa diganti dari sini).
- `pin_set`: apakah PIN sudah dibuat. Hash PIN dan token tidak pernah dikembalikan.
- Email ke karyawan dikirim lewat SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Saat development tanpa SMTP, isi email (termasuk tautan) dicetak di log server.

---

### **POST /owner/employees**

Menambah karyawan dan mengirim email berisi tautan verifikasi + pembuatan PIN.

**Request Body (JSON)**

```json
{ "name": "Ani", "email": "Ani@Example.com" }
```

- `name` (string, **wajib**): maksimum 100 karakter.
- `email` (string, **wajib**): format email valid, maksimum 254. Disimpan huruf kecil.

**Response (201 Created)**: objek karyawan ditambah `email_sent`.

```json
{
  "data": {
    "id": "...",
    "name": "Ani",
    "email": "ani@example.com",
    "status": "PENDING",
    "pin_set": false,
    "email_sent": true
  }
}
```

`email_sent: false` berarti karyawan sudah dibuat tetapi email gagal terkirim. Gunakan **kirim ulang** (di bawah).

**Error:** `400` validasi, `409 EMAIL_ALREADY_USED`.

---

### **GET /owner/employees**

**Query:** `search` (nama atau email, sebagian, tidak membedakan huruf besar kecil, maks 100), `status` (`ALL` bawaan, `ACTIVE`, `INACTIVE`), `page` (bawaan 1). Parameter lain ditolak (400). 20 per halaman, terbaru dulu.

**Response (200)**

```json
{ "data": [ { "...objek karyawan..." } ], "paging": { "page": 1, "per_page": 20, "total": 1, "total_pages": 1 } }
```

---

### **GET /owner/employees/:id**

Response `{ "data": { ...objek karyawan } }`. **Error:** `400` (id bukan UUID), `404 EMPLOYEE_NOT_FOUND`.

---

### **PUT /owner/employees/:id**

Mengubah sebagian data. Minimal satu field.

**Request Body (JSON)**

```json
{ "name": "Ani Baru", "email": "baru@example.com", "is_active": false }
```

- `name` (string), `email` (string), `is_active` (boolean sungguhan, bukan string).
- **Ganti email:** verifikasi dan PIN **dihapus**, tautan baru dikirim ke email baru, tautan lama tidak berlaku. Karyawan harus membuat PIN lagi. Response memuat `email_sent`. Mengirim email yang sama (beda huruf besar kecil) dianggap tidak berubah.
- **Nonaktifkan** (`is_active: false`): karyawan hilang dari daftar absen. Riwayat tetap.

**Error:** `400` (validasi, atau `EMPLOYEE_LINKED_TO_USER` saat mengganti email karyawan yang terhubung ke akun admin), `404 EMPLOYEE_NOT_FOUND`, `409 EMAIL_ALREADY_USED`.

---

### **POST /owner/employees/:id/resend-verification**

Mengirim tautan baru. Dipakai untuk email yang tidak sampai, tautan yang kedaluwarsa, atau **reset PIN** (karyawan lupa). Tautan lama otomatis hangus. PIN lama tetap berlaku sampai karyawan membuat yang baru.

Dibatasi **1 kali per menit** per karyawan.

**Response (200)**

```json
{
  "data": {
    "id": "0f6c...-uuid",
    "email": "ani@example.com",
    "email_sent": true
  }
}
```

**Error:** `400 EMPLOYEE_LINKED_TO_USER`, `404 EMPLOYEE_NOT_FOUND`, `409 EMPLOYEE_INACTIVE`, `429 VERIFICATION_RECENTLY_SENT`, `502 MAIL_SEND_FAILED`, `500 MAIL_NOT_CONFIGURED` (production tanpa SMTP).
