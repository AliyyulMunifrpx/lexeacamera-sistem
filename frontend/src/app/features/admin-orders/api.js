// Tambahkan ke file api feature order admin kamu (gunakan instance `api` yang sama

import api from "../../../lib/api/client.js";

// dengan fungsi lain, misalnya getCustomers).
export async function updateOrderPaymentStatus({ id, data }) {
  const response = await api.patch(`/admin/orders/${id}/payment-status`, data);
  return response.data;
}
