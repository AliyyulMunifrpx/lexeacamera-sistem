import api from "../../../lib/api/client.js";

export async function getAdminDashboard() {
  const response = await api.get("/admin/dashboard");

  return response.data.data;
}
