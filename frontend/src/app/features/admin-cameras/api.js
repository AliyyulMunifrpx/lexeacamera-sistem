import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /admin/cameras (ADMIN atau OWNER)
 * search (nama atau SKU, maks 100), category_id (UUID), page. 20 per halaman, terbaru dulu.
 * Tanpa modal dan profit. `images` hanya berisi gambar utama.
 * Parameter lain ditolak (400), jadi hanya tiga ini yang dikirim.
 * Mengembalikan { data, paging }.
 */
export async function getAdminCameras({ search, category_id, page = 1 } = {}) {
  const params = {
    ...(hasValue(search) && { search }),
    ...(hasValue(category_id) && { category_id }),
    page,
  };

  const response = await api.get("/admin/cameras", { params });

  return response.data;
}

/**
 * GET /admin/cameras/:id (ADMIN atau OWNER)
 * Tanpa modal dan profit. 404 CAMERA_NOT_FOUND jika tidak ada atau sudah dihapus.
 * `images`: gambar utama dulu; `marketplaceLinks`: hanya marketplace aktif.
 * Mengembalikan objek kamera.
 */
export async function getAdminCamera(id) {
  const response = await api.get(`/admin/cameras/${id}`);

  return response.data.data;
}

/**
 * PUT /admin/cameras/:id/marketplace (ADMIN atau OWNER)
 * Daftar yang dikirim MENGGANTIKAN semua link marketplace aktif. Kirim [] untuk menghapus semua.
 * Link ke marketplace nonaktif tidak ikut berubah.
 * Mengembalikan daftar link setelah perubahan.
 */
export async function updateAdminCameraMarketplace(id, marketplace) {
  const response = await api.put(`/admin/cameras/${id}/marketplace`, {
    marketplace,
  });

  return response.data.data;
}

/**
 * PUT /admin/cameras/:id/images (ADMIN atau OWNER, multipart/form-data)
 * Fields: keep_image_ids (JSON string), images (file, banyak), primary (id lama atau "new:N").
 * Mengembalikan daftar gambar setelah perubahan, gambar utama di urutan pertama.
 */
export async function updateAdminCameraImages(id, formData) {
  const response = await api.put(`/admin/cameras/${id}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data.data;
}
// Tambahkan ke api feature admin-cameras (pakai instance `api` yang sama dengan
// fungsi lain di file itu).
export async function updateAdminCameraDetails({ id, data }) {
  const response = await api.patch(`/admin/cameras/${id}`, data);
  return response.data;
}
