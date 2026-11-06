### **DELETE /admin/customers/:id**

Menghapus pelanggan **yang belum pernah punya order**. Memerlukan autentikasi. Bisa dipakai **ADMIN dan OWNER**.

Pelanggan yang sudah punya order (termasuk refund) tidak bisa dihapus, supaya riwayat order tetap tersambung ke pelanggannya.

#### **Path Parameter**

- `id` (string): id pelanggan (`cust-...`).

---

#### **Response Sukses (200 OK)**

```json
{
  "data": { "message": "CUSTOMER_DELETED" }
}
```

---

#### **Response Error**

1. **400 Bad Request**: format `id` salah.
2. **401 Unauthorized**: lihat `auth-overview.md`.
3. **404 Not Found**: `{ "errors": "CUSTOMER_NOT_FOUND" }`
4. **409 Conflict**: `{ "errors": "CUSTOMER_HAS_ORDERS" }`
