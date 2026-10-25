import api from "../../../lib/api/client.js";

export async function getHome() {
  const response = await api.get("/public/home");
  return response.data.data;
}
