import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (refreshToken) {
      config.headers["x-refresh-token"] = refreshToken;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      const accessToken = response.headers["x-new-access-token"];
      const refreshToken = response.headers["x-new-refresh-token"];

      if (accessToken) {
        localStorage.setItem("access_token", accessToken);
      }

      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }
    }

    return response;
  },
  (error) => Promise.reject(error),
);

export default api;
