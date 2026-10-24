import api from "../../../lib/api/client.js";

export async function getDashboard() {
  const response = await api.get("/dashboard");

  return response.data.data;
}
