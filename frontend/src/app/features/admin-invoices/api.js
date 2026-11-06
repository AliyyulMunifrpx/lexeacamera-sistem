import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /admin/invoices
 * search, created_from, created_to (YYYY-MM-DD, WIB), is_final (true/false), page.
 * 20 per halaman, terbaru dulu. Mengembalikan { data, paging }.
 * Tidak memuat modal (HPP) dan laba.
 */
export async function getInvoices({
  search,
  created_from,
  created_to,
  is_final,
  page = 1,
} = {}) {
  const params = {
    ...(hasValue(search) && { search }),
    ...(hasValue(created_from) && { created_from }),
    ...(hasValue(created_to) && { created_to }),
    ...(hasValue(is_final) && { is_final }),
    page,
  };

  const response = await api.get("/admin/invoices", { params });

  return response.data;
}

/** GET /admin/invoices/:id. Mengembalikan objek invoice lengkap. */
export async function getInvoice(id) {
  const response = await api.get(`/admin/invoices/${id}`);

  return response.data.data;
}

/**
 * POST /admin/invoices
 * Stok tidak dicek dan tidak berubah. Field lain (total_amount, subtotal,
 * no_invoice) ditolak backend, jadi payload dikirim apa adanya dari halaman.
 */
export async function createInvoice(payload) {
  const response = await api.post("/admin/invoices", payload);

  return response.data.data;
}

/**
 * PATCH /admin/invoices/:id
 * Hanya satu kali; setelah berhasil invoice menjadi final.
 */
export async function updateInvoice(id, payload) {
  const response = await api.patch(`/admin/invoices/${id}`, payload);

  return response.data.data;
}

/**
 * DELETE /admin/invoices/:id
 * Order yang sudah lunas tidak bisa dihapus (409 ORDER_ALREADY_PAID).
 */
export async function deleteInvoice(id) {
  const response = await api.delete(`/admin/invoices/${id}`);

  return response.data.data;
}
