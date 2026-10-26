import axios from "axios";

const ACCESS_KEY = "access_token"; // harus sama dengan token-storage.js
const REFRESH_KEY = "refresh_token";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    if (refreshToken) config.headers["x-refresh-token"] = refreshToken;
  }

  return config;
});

// true kalau request ini dikirim dengan token yang SAMA dengan yang tersimpan sekarang.
// Request lama (sebelum login / sebelum refresh terakhir) tidak boleh menimpa atau menghapus token.
function sentWithCurrentTokens(config) {
  const sent = config?.headers?.["x-refresh-token"] ?? null;
  return sent !== null && sent === localStorage.getItem(REFRESH_KEY);
}

api.interceptors.response.use(
  (response) => {
    if (typeof window === "undefined") return response;

    const newAccess = response.headers["x-new-access-token"];
    const newRefresh = response.headers["x-new-refresh-token"];

    // Simpan sebagai sepasang: refresh token itu sekali pakai
    if (newAccess && newRefresh && sentWithCurrentTokens(response.config)) {
      localStorage.setItem(ACCESS_KEY, newAccess);
      localStorage.setItem(REFRESH_KEY, newRefresh);
    }

    return response;
  },
  (error) => {
    if (typeof window !== "undefined") {
      const code = error.response?.data?.errors;
      const isAuthFailure =
        error.response?.status === 401 &&
        (code === "SESSION_EXPIRED" || code === "UNAUTHORIZED");

      if (isAuthFailure && sentWithCurrentTokens(error.config)) {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);

        if (!window.location.pathname.startsWith("/auth/")) {
          window.location.replace("/auth/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
