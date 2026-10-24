import api from "../../../lib/api/client.js";

export async function getMarketplaces({ is_active } = {}) {
  const params = {};

  if (typeof is_active === "boolean") {
    params.is_active = is_active;
  }

  const response = await api.get("/marketplaces", { params });

  return response.data.data;
}

export async function createMarketplace(formData) {
  const response = await api.post("/marketplaces", formData);

  return response.data.data;
}

export async function updateMarketplace(id, formData) {
  const response = await api.patch(`/marketplaces/${id}`, formData);

  return response.data.data;
}

export async function deleteMarketplace(id) {
  const response = await api.delete(`/marketplaces/${id}`);

  return response.data.data;
}
