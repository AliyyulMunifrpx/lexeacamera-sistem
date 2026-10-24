import api from "../../../lib/api/client.js";

export async function getCurrentUser() {
  const response = await api.get("/users/current");
  return response.data.data;
}

export async function updateCurrentName(name) {
  const response = await api.patch("/users/current/name", { name });
  return response.data.data ?? response.data;
}

export async function updateCurrentEmail(email) {
  const response = await api.patch("/users/current/email", { email });
  return response.data.data ?? response.data;
}

export async function updateCurrentPassword({
  current_password,
  new_password,
}) {
  const response = await api.patch("/users/current/password", {
    current_password,
    new_password,
  });

  return response.data.data ?? response.data;
}
export async function logoutCurrentUser() {
  const response = await api.post("/users/current/logout");
  return response.data;
}
