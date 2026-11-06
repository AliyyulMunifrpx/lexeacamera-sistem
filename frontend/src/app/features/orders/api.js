import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /owner/orders (khusus OWNER).
 * Hanya parameter yang terisi yang dikirim; parameter kosong dibuang.
 */
export async function getOwnerOrders({
  search,
  type,
  payment_status,
  date_field,
  date_from,
  date_to,
  page = 1,
} = {}) {
  const params = {
    ...(search && { search }),
    ...(type && { type }),
    ...(payment_status && { payment_status }),
    ...(date_field && { date_field }),
    ...(hasValue(date_from) && { date_from }),
    ...(hasValue(date_to) && { date_to }),
    page,
  };

  const response = await api.get("/owner/orders", { params });

  return response.data;
}

/**
 * GET /owner/orders/:id (khusus OWNER).
 * Mengembalikan objek order langsung (isi dari `data`).
 */
export async function getOwnerOrder(id) {
  const response = await api.get(`/owner/orders/${id}`);

  return response.data.data;
}

/**
 * PATCH /owner/orders/:id/payment-status (khusus OWNER).
 * Body: { payment_status: "PAID" | "UNPAID", paid_at?: ISO-8601 }
 * `paid_at` hanya boleh dikirim bersama PAID.
 */
export async function updateOrderPaymentStatus(
  id,
  { payment_status, paid_at },
) {
  const body = {
    payment_status,
    ...(payment_status === "PAID" && hasValue(paid_at) && { paid_at }),
  };

  const response = await api.patch(`/owner/orders/${id}/payment-status`, body);

  return response.data.data;
}

/**
 * PUT /owner/orders/:id/items (khusus OWNER).
 * Body: { items: [{ camera_id, quantity }] } (1-50 item, quantity 1-1000).
 * Daftar yang dikirim MENGGANTIKAN isi pesanan. Hanya order SALE yang belum lunas.
 * Mengembalikan detail order terbaru (bentuk sama dengan GET /owner/orders/:id).
 */
export async function updateOrderItems(id, { items }) {
  const body = {
    items: items.map(({ camera_id, quantity }) => ({ camera_id, quantity })),
  };

  const response = await api.put(`/owner/orders/${id}/items`, body);

  return response.data.data;
}
