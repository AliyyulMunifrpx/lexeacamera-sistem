import api from "../../../lib/api/client.js";

export async function getBanners() {
  // Query unik mencegah daftar admin memakai cache GET yang masih berlaku.
  // Backend mengabaikan query string sesuai dokumentasi endpoint.
  const response = await api.get("/banners", {
    params: { _: Date.now() },
  });

  return response.data.data;
}

export async function getBanner(id) {
  const response = await api.get(`/banners/${id}`);
  return response.data.data;
}

export async function createBanner(formData) {
  const response = await api.post("/banners", formData);
  return response.data.data;
}

export async function updateBanner(id, formData) {
  const response = await api.patch(`/banners/${id}`, formData);
  return response.data.data;
}

export async function deleteBanner(id) {
  const response = await api.delete(`/banners/${id}`);
  return response.data.data;
}
