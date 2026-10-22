### **DELETE /marketplaces/:id**

Menghapus marketplace beserta seluruh file logonya di storage. Marketplace yang masih dipakai kamera **tidak bisa dihapus**. Memerlukan autentikasi (_Bearer Token_).

#### **Parameters (URL Path)**

- `id` (string, UUID, **Required**): ID unik marketplace yang akan dihapus.

---

#### **Response Sukses (200 OK)**

```json
{
  "data": {
    "message": "MARKETPLACE_DELETED"
  }
}
```

---

#### **Response Error**

1. **401 Unauthorized** (Token tidak valid, kedaluwarsa, atau header `Authorization` kosong)

```json
{
  "errors": "UNAUTHORIZED"
}
```

2. **404 Not Found** (Marketplace tidak ditemukan, atau sudah dihapus sebelumnya)

```json
{
  "errors": "MARKETPLACE_NOT_FOUND"
}
```

3. **400 Bad Request** (ID bukan UUID, atau marketplace masih dipakai kamera)

```json
{
  "errors": "MARKETPLACE_STILL_IN_USE",
  "details": {
    "total": 12,
    "cameras": [
      {
        "id": "dbdc9eab-6262-45ec-a04b-c1bcce75052f",
        "name": "Canon EOS 1500D"
      },
      {
        "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
        "name": "Nikon D3500"
      }
    ]
  }
}
```

- `details.total`: jumlah kamera yang memakai marketplace ini.
- `details.cameras`: maksimum **10** kamera pertama (urut nama), jadi bisa lebih sedikit dari `total`.
- Kamera yang sudah dihapus (soft delete) **tidak dihitung** dan tidak memblokir. Link milik kamera tersebut ikut terhapus bersama marketplace.

> Jika pembersihan file logo di storage gagal, marketplace tetap terhapus dan kegagalannya hanya dicatat di log server.
