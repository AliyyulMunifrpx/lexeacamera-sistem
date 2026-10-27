import api from "../../../lib/api/client.js";

export async function GetTerms() {
  const response = await api.get("/terms");
  return response.data.data;
}
export async function updateTerms(value) {
  const response = await api.put("/terms", { value });
  return response.data;
}
