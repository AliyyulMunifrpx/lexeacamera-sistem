export function saveAuthTokens(data) {
  if (typeof window === "undefined") return;

  if (data?.access_token) {
    localStorage.setItem("access_token", data.access_token);
  }

  if (data?.refresh_token) {
    localStorage.setItem("refresh_token", data.refresh_token);
  }
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
