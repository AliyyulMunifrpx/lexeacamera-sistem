import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /admin/orders/:id/refunds
 * Ringkasan refund: sisa barang & nominal yang masih bisa direfund + daftar refund.
 * Mengembalikan isi `data`.
 */
export async function getOrderRefunds(orderId) {
  const response = await api.get(`/admin/orders/${orderId}/refunds`);

  return response.data.data;
}

/**
 * POST /admin/orders/:id/refunds
 * items: [{ camera_id, quantity, restocked }]
 * amount, payment_method, payment_status, paid_at bersifat opsional.
 * `paid_at` hanya dikirim bersama PAID.
 */
export async function createRefund(
  orderId,
  { items, amount, payment_method, payment_status, paid_at },
) {
  const body = {
    items: items.map(({ camera_id, quantity, restocked }) => ({
      camera_id,
      quantity,
      restocked,
    })),
    ...(hasValue(amount) && { amount }),
    ...(hasValue(payment_method) && { payment_method }),
    ...(payment_status && { payment_status }),
    ...(payment_status === "PAID" && hasValue(paid_at) && { paid_at }),
  };

  const response = await api.post(`/admin/orders/${orderId}/refunds`, body);

  return response.data.data;
}

/**
 * DELETE /admin/refunds/:id
 * Hanya untuk refund yang belum lunas.
 */
export async function deleteRefund(refundId) {
  const response = await api.delete(`/admin/refunds/${refundId}`);

  return response.data;
}
