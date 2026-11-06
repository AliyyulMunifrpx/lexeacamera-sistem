## Verifikasi email dan membuat PIN (tanpa login)

Karyawan menerima email berisi tautan `https://<FRONTEND_URL>/employee/set-pin?token=<token>`. Halaman itu membaca `token` dari URL dan memanggil dua endpoint di bawah. Tautan berlaku **24 jam** dan hanya bisa dipakai **sekali**. Endpoint ini **tidak dibatasi jaringan toko** (karyawan boleh membuat PIN dari rumah). Dibatasi oleh `publicLimiter`.

Kode error umum: `400 INVALID_OR_EXPIRED_TOKEN` (token tidak dikenal, kedaluwarsa, sudah dipakai, sudah digantikan tautan yang lebih baru, atau karyawan sudah nonaktif), dan `400` dengan pesan validasi kalau format token bukan 64 karakter heksadesimal.

---

### **POST /public/employees/token-info**

Dipakai halaman untuk memeriksa tautan sebelum menampilkan form PIN.

**Request Body (JSON)**

```json
{ "token": "9f2c...(64 karakter heksadesimal)" }
```

**Response (200)**

```json
{ "data": { "name": "Ani", "pin_set": false } }
```

`pin_set: true` berarti ini tautan untuk **mengganti PIN** (karyawan sudah punya PIN).

---

### **POST /public/employees/set-pin**

Membuat PIN dan sekaligus **memverifikasi email**.

**Request Body (JSON)**

```json
{ "token": "9f2c...", "pin": "4821" }
```

- `pin` (string, **wajib**): 4 sampai 6 digit angka.

**Response (200)**

```json
{ "data": { "name": "Ani" } }
```

- PIN disimpan dalam bentuk hash, tidak ada yang bisa melihat PIN aslinya (owner pun tidak).
- Tautan langsung hangus. Kalau tautan ini dipakai untuk mengganti PIN, hitungan salah PIN dan kunci direset.
- Setelah ini karyawan muncul di daftar absen.
