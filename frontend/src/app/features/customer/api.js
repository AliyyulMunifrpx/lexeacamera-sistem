import api from "../../../lib/api/client.js";
export async function getCustomers({ search, page = 1 } = {}) {
  const params = {
    ...(search && { search }),
    page,
  };

  const response = await api.get("/admin/customers", { params });
  return response.data;
}

export async function getCustomerSummary() {
  const response = await api.get("/admin/customers/summary");
  return response.data;
}
export async function createCustomer(payload) {
  const response = await api.post("/admin/customers", payload);

  return response.data;
}
export async function getCustomer(id) {
  const response = await api.get(`/admin/customers/${id}`);
  return response.data;
}
export async function deleteCustomer(id) {
  const response = await api.delete(`/admin/customers/${id}`);
  return response.data;
}
export async function updateCustomer(id, data) {
  const response = await api.put(`/admin/customers/${id}`, data);
  return response.data;
}
