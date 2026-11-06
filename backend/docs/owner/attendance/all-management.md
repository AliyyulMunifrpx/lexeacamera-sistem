## Wifi toko dan pengaturan absen (OWNER)

Semua endpoint memerlukan autentikasi dan role **OWNER**.

Absen publik hanya diterima dari IP yang cocok dengan salah satu **jaringan aktif** di bawah, selama pengaturan `require_network` menyala. Setiap jaringan disimpan dalam bentuk kanonik `alamat/prefix`: IPv4 tunggal menjadi `203.0.113.7/32`, dan bit host dibuang (`192.0.2.77/24` menjadi `192.0.2.0/24`).

**Cara mendaftarkan wifi toko dengan "ambil IP otomatis"**

1. Owner membuka halaman ini dari perangkat yang tersambung ke wifi toko.
2. Frontend memanggil `GET /public/my-ip` **langsung ke backend** (bukan lewat proxy `/api`), dan menampilkan IP-nya.
3. Owner menekan simpan, frontend mengirim `suggested_cidr` ke `POST /owner/attendance-networks`.
4. Kalau IP toko berubah (ISP), ulangi langkah yang sama, lalu nonaktifkan atau hapus yang lama. Atau ganti dengan `PUT` yang berisi `cidr` baru.

**Batas:** IPv4 minimal `/16`, IPv6 minimal `/48` (lebih luas ditolak `CIDR_TOO_BROAD`), maksimal 20 jaringan. Server harus mengatur `trust proxy` sesuai jumlah proxy hosting supaya IP yang terbaca benar.

---

### **GET /owner/attendance-networks**

```json
{
  "data": [
    {
      "id": "0f6c...-uuid",
      "cidr": "203.0.113.0/24",
      "label": "Wifi toko",
      "is_active": true,
      "created_at": "2026-10-30T01:00:00.000Z"
    }
  ]
}
```

### **POST /owner/attendance-networks**

**Request Body**: `{ "label": "Wifi toko", "cidr": "203.0.113.7" }`. `label` (maks 100) dan `cidr` (IPv4/IPv6, boleh dengan `/prefix`) **wajib**. Field lain ditolak.

**Response (201)**: objek jaringan.

**Error:** `400 INVALID_CIDR`, `400 CIDR_TOO_BROAD`, `400` validasi, `409 NETWORK_ALREADY_EXISTS` (termasuk kalau ejaannya beda tetapi hasil kanoniknya sama), `409 NETWORK_LIMIT_REACHED`.

### **PUT /owner/attendance-networks/:id**

Minimal satu dari `label`, `cidr`, `is_active` (boolean). Response `{ "data": objek jaringan }`.

**Error:** `400`, `404 NETWORK_NOT_FOUND`, `409 NETWORK_ALREADY_EXISTS`.

### **DELETE /owner/attendance-networks/:id**

Response `{ "data": { "message": "NETWORK_DELETED" } }`. **Error:** `404 NETWORK_NOT_FOUND`.

---

### **GET /owner/attendance-settings**

````json
{ "data": { "require_network": true, "active_networks": 1 } }
```a

`require_network: true` tetapi `active_networks: 0` berarti **tidak ada yang bisa absen** (sengaja ditolak semua). Tampilkan peringatan di layar.

### **PUT /owner/attendance-settings**

**Request Body**: `{ "require_network": false }` (boolean sungguhan, wajib). `false` = absen boleh dari mana saja (saklar darurat kalau IP toko berubah dan belum sempat diperbarui). Response sama dengan GET.

**Error:** `400`, `503 STORE_NOT_READY`.
````
