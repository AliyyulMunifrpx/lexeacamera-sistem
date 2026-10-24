import api from "../../../lib/api/client.js";

export async function getCategories() {
  const response = await api.get("/category");

  return response.data.data;
}

export async function createCategory(name) {
  const response = await api.post("/category", { name });

  return response.data.data;
}

export async function updateCategory(id, name) {
  const response = await api.patch(`/category/${id}`, { name });

  return response.data.data;
}

export async function deleteCategory(id) {
  const response = await api.delete(`/category/${id}`);

  return response.data;
}