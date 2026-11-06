import api from "../../../lib/api/client.js";

export async function getAdminMarketplaces() {
  const response = await api.get("/admin/marketplaces");

  return response.data;
}
