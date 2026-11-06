import axios from "axios";

// Browser lewat proxy Next.js (/api, lihat rewrites di next.config.js) supaya cookie
// milik domain frontend. Di server (SSR) tidak ada proxy, langsung ke backend.
const api = axios.create({
  baseURL:
    typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_URL : "/api",
  timeout: 90000,
  withCredentials: true,
});
export const apiServer = axios.create({
  baseURL:
    typeof window === "undefined" ? process.env.NEXT_PUBLIC_API_URL : "/api",
  timeout: 90000,
  withCredentials: true,
});
// Dipanggil setelah login dan logout berhasil. 401 dari request yang berangkat
// sebelum itu (balasnya telat) diabaikan, supaya tidak melempar user yang baru
// login kembali ke halaman login.
let authChangedAt = 0;
export const markAuthChanged = () => {
  authChangedAt = Date.now();
};

api.interceptors.request.use((config) => {
  config.metadata = { startedAt: Date.now() };
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const code = error.response?.data?.errors;
      const isAuthFailure =
        error.response?.status === 401 &&
        (code === "SESSION_EXPIRED" || code === "UNAUTHORIZED");
      const isStale = (error.config?.metadata?.startedAt ?? 0) < authChangedAt;

      if (
        isAuthFailure &&
        !isStale &&
        !window.location.pathname.startsWith("/auth/")
      ) {
        window.location.replace("/auth/login");
      }
    }

    return Promise.reject(error);
  },
);

export default api;
