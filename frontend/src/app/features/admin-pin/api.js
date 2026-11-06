import api from "../../../lib/api/client.js";

export async function updateCurrentPin(payload) {
  const response = await api.put("/users/pin", payload);
  return response.data;
}
