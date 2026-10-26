export function saveAuthTokens(data) {
  if (typeof window === "undefined") return;

  // Simpan sebagai sepasang. Kalau salah satu tidak ada, jangan campur dengan token lama.
  if (!data?.access_token || !data?.refresh_token) {
    clearAuthTokens();
    return;
  }

  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem("refresh_token");
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem("access_token");
}
