## Kelola karyawan (OWNER)

Semua endpoint di sini memerlukan autentikasi (cookie, lihat `auth-overview.md`) dan role **OWNER**. ADMIN mendapat 403. Karyawan **tidak punya akun login**: mereka hanya memverifikasi email lalu membuat PIN sendiri (owner tidak pernah tahu PIN-nya). Karyawan bisa **dinonaktifkan** (riwayat absen tetap) atau **dihapus permanen** (riwayat absen dan kontraknya ikut hilang).

**Objek karyawan**

```json
{
  "id": "0f6c...-uuid",
  "name": "Ani",
  "email": "ani@example.com",
  "display_id": "K1",
  "job_title": "Kasir",
  "bank_name": "BCA",
  "account_number": "1234567890",
  "account_holder": "Ani Wijaya",
  "contract_count": 2,
  "contract_start": "2027-01-01",
  "contract_end": "2027-12-31",
  "contract_status": "ACTIVE",
  "contract_days_left": 48,
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
- **Kontrak:** satu karyawan bisa punya banyak kontrak (lihat bagian "Kontrak karyawan"). `contract_start`, `contract_end`, `contract_status`, dan `contract_days_left` adalah ringkasan dari **kontrak yang sedang relevan**: yang berjalan (`ACTIVE`); kalau tidak ada, yang paling dekat akan datang (`UPCOMING`); kalau tidak ada, yang terakhir berakhir (`ENDED`). `contract_count` adalah jumlah semua kontrak. Tanpa kontrak: `contract_status: "NONE"`, tanggal dan `contract_days_left` bernilai `null`, `contract_count: 0`.
- Email ke karyawan dikirim lewat API Brevo (HTTPS, bukan SMTP, karena Render Free memblokir port SMTP). Env: `BREVO_API_KEY` dan `MAIL_FROM` (alamat pengirim yang sudah diverifikasi di Brevo, boleh `Nama <email@domain.com>`). Saat development tanpa env itu, isi email (termasuk tautan) dicetak di log server.

---

### **POST /owner/employees**

Menambah karyawan dan mengirim email berisi tautan verifikasi + pembuatan PIN.

**Request Body (JSON)**

```json
{
  "name": "Ani",
  "email": "Ani@Example.com",
  "display_id": "k1",
  "job_title": "Kasir",
  "bank_name": "BCA",
  "account_number": "1234567890",
  "account_holder": "Ani Wijaya",
  "contract_start": "2026-01-01",
  "contract_end": "2026-12-31"
}
```

- `name` (string, **wajib**): maksimum 100 karakter.
- `email` (string, **wajib**): format email valid, maksimum 254. Disimpan huruf kecil.
- `display_id` (string, **wajib**): maksimum 10 karakter. Disimpan huruf besar.
- `job_title`, `bank_name`, `account_number`, `account_holder` (string, **wajib**): 1 sampai 100 karakter.
- `contract_start`, `contract_end` (opsional): tanggal `YYYY-MM-DD`, tahun 2000 sampai 2100, atau `null`. Kalau `contract_start` diisi, dibuat **Kontrak 1** untuk karyawan ini. `contract_end` boleh dikosongkan (kontrak tanpa batas), tetapi tidak boleh diisi tanpa `contract_start`. Kontrak berikutnya ditambah lewat endpoint kontrak.

**Response (201 Created)**: objek karyawan ditambah `email_sent`.

```json
{
  "data": {
    "id": "...",
    "name": "Ani",
    "email": "ani@example.com",
    "status": "PENDING",
    "pin_set": false,
    "contract_count": 1,
    "email_sent": true
  }
}
```

`email_sent: false` berarti karyawan sudah dibuat tetapi email gagal terkirim. Gunakan **kirim ulang** (di bawah).

**Error:** `400` validasi, `400 CONTRACT_START_REQUIRED` (ada `contract_end` tanpa `contract_start`), `400 INVALID_CONTRACT_PERIOD` (akhir lebih awal dari awal), `409 EMAIL_ALREADY_USED`.

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

- `name`, `email`, `display_id`, `job_title`, `bank_name`, `account_number`, `account_holder` (string, aturan sama seperti saat menambah), `is_active` (boolean sungguhan, bukan string).
- **Kontrak tidak diubah lewat endpoint ini.** Field `contract_start` dan `contract_end` ditolak (400). Gunakan endpoint kontrak di bawah.
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

**Error:** `400 EMPLOYEE_LINKED_TO_USER`, `404 EMPLOYEE_NOT_FOUND`, `409 EMPLOYEE_INACTIVE`, `429 VERIFICATION_RECENTLY_SENT`, `502 MAIL_SEND_FAILED`, `500 MAIL_NOT_CONFIGURED` (production tanpa `BREVO_API_KEY` atau `MAIL_FROM`).

---

### **DELETE /owner/employees/:id**

Menghapus karyawan **permanen** beserta **seluruh riwayat absen dan kontraknya**. Tidak bisa dibatalkan. Kalau riwayat absen harus tetap ada, gunakan `PUT` dengan `is_active: false`.

Karyawan yang terhubung ke akun admin (`linked_to_user: true`) hanya dihapus sebagai karyawan, akun adminnya tidak ikut terhapus.

Slip gaji karyawan itu (lihat `owner-payrolls.md`) **tidak ikut terhapus**: slipnya tetap ada dengan `employee_id: null`, sedangkan nama dan data bank di slip tetap tersimpan.

**Response (200)**

```json
{ "data": { "message": "EMPLOYEE_DELETED", "deleted_attendances": 42 } }
```

**Error:** `400` (id bukan UUID), `404 EMPLOYEE_NOT_FOUND`.

---

## Kontrak karyawan (OWNER)

Satu karyawan boleh punya banyak kontrak: Kontrak 1, lalu Kontrak 2 sebagai perpanjangan, dan seterusnya. Status kontrak tidak mempengaruhi `is_active` atau kemampuan absen.

**Objek kontrak**

```json
{
  "id": "7b1e...-uuid",
  "employee_id": "0f6c...-uuid",
  "contract_number": 2,
  "start_date": "2027-01-01",
  "end_date": "2027-12-31",
  "note": "Perpanjangan 1 tahun",
  "status": "ACTIVE",
  "days_left": 48,
  "created_at": "2026-12-20T01:00:00.000Z"
}
```

- `contract_number`: urutan kontrak karyawan itu berdasarkan `start_date` (1 = paling awal). Nomor dihitung ulang otomatis, jadi kalau Kontrak 1 dihapus, Kontrak 2 menjadi Kontrak 1.
- `start_date` (wajib) dan `end_date` (opsional, `null` = tanpa batas): format `YYYY-MM-DD`, tahun 2000 sampai 2100. `end_date` tidak boleh lebih awal dari `start_date` (boleh sama). Tanggal akhir **ikut dihitung**: di hari akhir statusnya masih `ACTIVE`.
- `status`: `UPCOMING` (belum mulai), `ACTIVE` (berjalan), `ENDED` (sudah lewat akhir).
- `days_left`: sisa hari sampai `end_date` menurut tanggal WIB. `0` di hari terakhir, negatif kalau sudah lewat (`-3` = berakhir 3 hari lalu), `null` kalau `end_date` kosong.
- **Periode kontrak satu karyawan tidak boleh bertabrakan.** Kontrak tanpa `end_date` dianggap berjalan tanpa batas, jadi untuk menambah perpanjangan, isi dulu `end_date` kontrak sebelumnya. Kontrak baru boleh dimulai sehari setelah kontrak sebelumnya berakhir.
- `note`: opsional, maksimum 255 karakter.

---

### **GET /owner/employees/:id/contracts**

Semua kontrak karyawan, urut dari yang paling awal.

**Response (200)**: `{ "data": [ { ...objek kontrak } ] }`

**Error:** `400` (id bukan UUID), `404 EMPLOYEE_NOT_FOUND`.

---

### **POST /owner/employees/:id/contracts**

Menambah kontrak (misalnya perpanjangan).

**Request Body (JSON)**

```json
{
  "start_date": "2027-01-01",
  "end_date": "2027-12-31",
  "note": "Perpanjangan 1 tahun"
}
```

**Response (201 Created)**: `{ "data": { ...objek kontrak } }`

**Error:** `400` validasi, `400 INVALID_CONTRACT_PERIOD`, `404 EMPLOYEE_NOT_FOUND`, `409 CONTRACT_OVERLAP`.

---

### **PUT /owner/employees/:id/contracts/:contract_id**

Mengubah sebagian kontrak. Minimal satu field dari `start_date`, `end_date`, `note`. Kirim `end_date: null` untuk mengosongkan akhir kontrak, dan `note: ""` atau `null` untuk mengosongkan catatan. Cek tanggal dilakukan terhadap nilai yang sudah tersimpan.

**Request Body (JSON)**

```json
{ "end_date": "2027-06-30" }
```

**Response (200)**: `{ "data": { ...objek kontrak } }`

**Error:** `400` validasi, `400 INVALID_CONTRACT_PERIOD`, `404 EMPLOYEE_NOT_FOUND`, `404 CONTRACT_NOT_FOUND`, `409 CONTRACT_OVERLAP`.

---

### **DELETE /owner/employees/:id/contracts/:contract_id**

Menghapus satu kontrak. Tidak bisa dibatalkan.

**Response (200)**: `{ "data": { "message": "CONTRACT_DELETED" } }`

**Error:** `400` (id bukan UUID), `404 CONTRACT_NOT_FOUND`.
