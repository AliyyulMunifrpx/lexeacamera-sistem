import api from "../../../lib/api/client.js";

export async function registerUser(payload) {
  const response = await api.post("/users/register", payload);
  return response.data.data;
}
export async function setPasswordUser(email) {
  const response = await api.post("/public/auth/set-password", email);
  return response.data;
}
export async function forgotPassword(email) {
  const response = await api.post("/public/auth/forgot-password", email);
  return response.data;
}
export async function loginUser(payload) {
  const response = await api.post("/users/login", payload);
  return response.data.data;
}

export async function getCurrentUser() {
  const response = await api.get("/users/current");
  return response.data.data;
}

export async function logoutUser() {
  const response = await api.post("/users/current/logout");
  return response.data;
}
