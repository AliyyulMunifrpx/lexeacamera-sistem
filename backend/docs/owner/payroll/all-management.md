## Gaji karyawan (OWNER)

Semua endpoint di sini memerlukan autentikasi (cookie, lihat `auth-overview.md`) dan role **OWNER**. ADMIN mendapat 403. Satu slip gaji = satu karyawan untuk satu tanggal cair, berisi daftar **penerimaan** (gaji pokok, insentif sales kamera, dll). Setiap penerimaan punya `name`, `note` (keterangan), `checked` (ceklis), dan `amount` (jumlah).

**Objek slip gaji**

```json
{
  "id": "5b1e...-uuid",
  "employee_id": "0f6c...-uuid",
  "employee_name": "Ani",
  "job_title": "Kasir",
  "bank_name": "BCA",
  "account_number": "1234567890",
  "account_holder": "Ani Wijaya",
  "disbursement_date": "2026-11-25",
  "status": "PENDING",
  "total_amount": 3500000,
  "created_at": "2026-11-11T03:00:00.000Z",
  "updated_at": "2026-11-11T03:00:00.000Z",
  "items": [
    {
      "id": "a1...",
      "name": "Gaji pokok",
      "note": "Bulan November",
      "checked": true,
      "amount": 3000000
    },
    {
      "id": "a2...",
      "name": "Insentif sales kamera",
      "note": null,
      "checked": false,
      "amount": 500000
    }
  ]
}
```

- `status`: `PENDING` (belum cair) atau `PAID` (sudah cair). `disbursement_date` = tanggal cair, format `YYYY-MM-DD`.
- `total_amount` = jumlah semua `items.amount`. Dihitung server, tidak bisa dikirim dari client.
- `employee_name` adalah salinan nama saat slip dibuat. Jabatan, bank, nomor rekening, dan atas nama juga disimpan **per slip** (bukan diambil live dari data karyawan), jadi slip lama tidak berubah kalau data karyawan berubah.
- Kalau karyawan dihapus, slip **tetap ada**: `employee_id` jadi `null`, nama dan data bank tetap.
- Urutan `items` mengikuti urutan saat dikirim.
- Slip yang `PAID` dihitung sebagai pengeluaran gaji di laporan (lihat bagian paling bawah).

---

### **POST /owner/payrolls**

**Request Body (JSON)**

```json
{
  "employee_id": "0f6c...-uuid",
  "job_title": "Kasir",
  "bank_name": "BCA",
  "account_number": "1234567890",
  "account_holder": "Ani Wijaya",
  "disbursement_date": "2026-11-25",
  "status": "PENDING",
  "items": [
    {
      "name": "Gaji pokok",
      "note": "Bulan November",
      "checked": true,
      "amount": 3000000
    },
    { "name": "Insentif sales kamera", "amount": 500000 }
  ]
}
```

- `employee_id` (UUID, **wajib**), `job_title`, `bank_name`, `account_holder` (string, **wajib**, 1 sampai 100 karakter).
- `account_number` (string, **wajib**): angka, boleh spasi atau strip, 4 sampai 30 karakter.
- `disbursement_date` (**wajib**): `YYYY-MM-DD`, tanggal valid, tahun 2000 sampai 2100. Boleh tanggal depan untuk slip `PENDING`.
- `status` (opsional): `PENDING` (bawaan) atau `PAID`. `PAID` tidak boleh dengan tanggal cair di masa depan (waktu WIB).
- `items` (**wajib**): 1 sampai 50 penerimaan. Tiap item: `name` (wajib, maks 100), `note` (opsional, maks 500, kosong disimpan `null`), `checked` (boolean, bawaan `false`), `amount` (**wajib**, bilangan bulat rupiah, 0 sampai 2.147.483.647).
- Field lain (misalnya `total_amount`) ditolak (400).

**Response (201 Created)**: `{ "data": { ...objek slip } }`

**Error:** `400` validasi, `400 AMOUNT_TOO_LARGE` (total semua item melebihi batas), `400 DISBURSEMENT_DATE_IN_FUTURE`, `404 EMPLOYEE_NOT_FOUND`.

---

### **GET /owner/payrolls**

**Query:** `employee_id` (UUID), `status` (`PENDING` atau `PAID`), `date_from`, `date_to` (`YYYY-MM-DD`, inklusif, berdasarkan tanggal cair), `search` (nama karyawan atau jabatan, sebagian, tidak membedakan huruf besar kecil), `page` (bawaan 1). Parameter lain ditolak (400). 20 per halaman, tanggal cair terbaru dulu.

**Response (200)**

```json
{
  "data": [
    {
      "id": "5b1e...",
      "employee_id": "0f6c...",
      "employee_name": "Ani",
      "job_title": "Kasir",
      "disbursement_date": "2026-11-25",
      "status": "PENDING",
      "total_amount": 3500000,
      "created_at": "2026-11-11T03:00:00.000Z",
      "item_count": 2
    }
  ],
  "summary": { "paid_amount": 7000000, "pending_amount": 3500000 },
  "paging": { "page": 1, "per_page": 20, "total": 1, "total_pages": 1 }
}
```

- Daftar tidak memuat `items` maupun data bank (ambil lewat detail).
- `summary` dihitung dari **semua** slip yang cocok dengan filter, bukan hanya halaman ini.

**Error:** `400` (validasi, atau `INVALID_DATE_RANGE` kalau `date_from` > `date_to`).

---

### **GET /owner/employees/:id/payrolls**

Daftar slip untuk satu karyawan. Query dan response sama seperti `GET /owner/payrolls` (kecuali `employee_id` tidak boleh dikirim di query karena sudah ada di URL).

**Error:** `400` (id bukan UUID atau query salah), `404 EMPLOYEE_NOT_FOUND`.

Catatan: karyawan yang sudah dihapus tidak bisa dilihat lewat endpoint ini. Slip miliknya tetap muncul di `GET /owner/payrolls`.

---

### **GET /owner/payrolls/:id**

Response `{ "data": { ...objek slip } }`. **Error:** `400` (id bukan UUID), `404 PAYROLL_NOT_FOUND`.

---

### **PATCH /owner/payrolls/:id**

Mengubah slip yang masih `PENDING`. Minimal satu field dari: `job_title`, `bank_name`, `account_number`, `account_holder`, `disbursement_date`, `items`. Aturannya sama dengan saat membuat.

- Kalau `items` dikirim, seluruh daftar **diganti** dan `total_amount` dihitung ulang. Kalau tidak dikirim, item tidak berubah.
- `employee_id`, `employee_name`, `status`, dan `total_amount` tidak bisa diubah di sini (400). Status lewat endpoint di bawah.

**Error:** `400` validasi, `400 AMOUNT_TOO_LARGE`, `404 PAYROLL_NOT_FOUND`, `409 PAYROLL_ALREADY_PAID` (slip sudah `PAID`, kembalikan ke `PENDING` dulu kalau mau diedit).

---

### **PATCH /owner/payrolls/:id/status**

Menandai cair atau membatalkan.

**Request Body (JSON)**

```json
{ "status": "PAID", "disbursement_date": "2026-11-25" }
```

- `status` (**wajib**): `PENDING` atau `PAID`.
- `disbursement_date` (opsional): tanggal cair yang dikoreksi. Kalau status `PAID` dan tanggal tidak dikirim, tanggal cair yang tersimpan dipakai. Kalau tanggal itu masih di masa depan, ditolak, jadi kirim tanggal hari ini atau sebelumnya.
- Mengirim status yang sama dengan yang tersimpan tidak mengubah apa pun (aman dipanggil ulang).

**Response (200)**: `{ "data": { ...objek slip } }`

**Error:** `400` validasi, `400 DISBURSEMENT_DATE_IN_FUTURE`, `404 PAYROLL_NOT_FOUND`.

---

### **PATCH /owner/payrolls/:id/items/:item_id**

Mencentang atau membatalkan ceklis satu penerimaan. Boleh dilakukan pada slip `PENDING` maupun `PAID`. Ceklis hanya penanda, tidak mengubah `total_amount`.

**Request Body (JSON)**

```json
{ "checked": true }
```

`checked` wajib boolean sungguhan. **Response (200)**: `{ "data": { ...objek slip } }`

**Error:** `400` validasi, `404 PAYROLL_ITEM_NOT_FOUND` (item tidak ada, atau bukan milik slip ini).

---

### **DELETE /owner/payrolls/:id**

Menghapus slip `PENDING` beserta item-nya. **Response (200)**: `{ "data": { "message": "PAYROLL_DELETED" } }`

**Error:** `400` (id bukan UUID), `404 PAYROLL_NOT_FOUND`, `409 PAYROLL_ALREADY_PAID` (kembalikan ke `PENDING` dulu).

---

### Memotong omzet (laporan)

Gaji dihitung ke laporan **hanya untuk slip `PAID`**, berdasarkan `disbursement_date` (tanggal cair), bukan tanggal dibuat. Slip `PENDING` tidak mengurangi apa pun. Kalau slip dikembalikan ke `PENDING` atau dihapus, angka laporan ikut kembali karena dihitung langsung dari data.

Patch untuk `getSummary` di `report-service.js` (tambahan saja, field lama tidak berubah):

```js
const payrollFrom = req.from ?? "1900-01-01";
const payrollTo = req.to ?? "3000-01-01";

const [payrollRow] = await prisma.$queryRaw`
  SELECT COUNT(*) AS count, COALESCE(SUM(total_amount::bigint), 0) AS amount
  FROM "Payroll"
  WHERE status = 'PAID'
    AND disbursement_date >= ${payrollFrom}::date
    AND disbursement_date <= ${payrollTo}::date`;

const payroll = {
  count: Number(payrollRow.count),
  amount: Number(payrollRow.amount),
};
```

Lalu di return tambahkan:

```js
payroll,
net: {
  ...base.net,
  revenue_after_payroll: base.net.revenue - payroll.amount,
  profit_after_payroll: base.net.profit - payroll.amount,
},
```

`req.from` dan `req.to` harus berformat `YYYY-MM-DD` (tanggal WIB). Sesuaikan nama variabel `base` dengan hasil query yang sudah ada di fungsi itu. Tren/grafik per hari tidak ikut diubah.

---

### Migrasi database

Tambahkan model dari `prisma/payroll-schema.prisma` ke `schema.prisma`, dan tambahkan satu baris di model `Employee`:

```prisma
payrolls Payroll[]
```

Lalu jalankan `npx prisma migrate dev --name add_payroll` (lokal) dan `npx prisma migrate deploy` (production). Relasi ke karyawan memakai `onDelete: SetNull`, jadi menghapus karyawan tidak menghapus slip.

### Daftar error

| Status | Pesan                                                                                  |
| ------ | -------------------------------------------------------------------------------------- |
| 400    | `AMOUNT_TOO_LARGE`, `DISBURSEMENT_DATE_IN_FUTURE`, `INVALID_DATE_RANGE`, validasi lain |
| 404    | `PAYROLL_NOT_FOUND`, `PAYROLL_ITEM_NOT_FOUND`, `EMPLOYEE_NOT_FOUND`                    |
| 409    | `PAYROLL_ALREADY_PAID`                                                                 |
