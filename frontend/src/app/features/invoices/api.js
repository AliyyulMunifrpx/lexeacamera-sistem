import api from "../../../lib/api/client.js";

export async function getInvoices({
  search,
  created_from,
  created_to,
  is_final,
  page = 1,
} = {}) {
  const params = { page };

  if (search?.trim()) {
    params.search = search.trim();
  }

  if (created_from) {
    params.created_from = created_from;
  }

  if (created_to) {
    params.created_to = created_to;
  }

  if (is_final === true || is_final === "true") {
    params.is_final = true;
  } else if (is_final === false || is_final === "false") {
    params.is_final = false;
  }

  const response = await api.get("/invoices", { params });

  return response.data;
}
export async function createInvoice(payload) {
  const response = await api.post("/invoices", payload);
  return response.data.data;
}

export async function getInvoice(id) {
  const response = await api.get(`/invoices/${id}`);
  return response.data.data;
}
export function deleteInvoice({ id, mode }) {
  return api.delete(`/owner/invoices/${id}`, { params: { mode } });
}
export async function updateInvoice(id, payload) {
  const response = await api.patch(`/invoices/${id}`, payload);
  return response.data.data;
}
