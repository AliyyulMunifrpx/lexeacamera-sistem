import api from "../../../lib/api/client.js";

export async function getStore() {
  const response = await api.get("/store");
  return response.data.data;
}

export async function createStore(formData) {
  const response = await api.post("/store", formData);
  return response.data.data;
}
export async function updateStore(formData) {
  const response = await api.patch("/store", formData);
  return response.data.data;
}
