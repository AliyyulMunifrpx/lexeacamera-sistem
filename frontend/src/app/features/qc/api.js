import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/** GET /admin/quality-controls. Mengembalikan { data, paging }. */
export async function getQualityControls({
  search,
  date_from,
  date_to,
  type,
  status,
  page = 1,
} = {}) {
  const params = {
    ...(hasValue(search) && { search }),
    ...(hasValue(date_from) && { date_from }),
    ...(hasValue(date_to) && { date_to }),
    ...(hasValue(type) && { type }),
    ...(hasValue(status) && { status }),
    page,
  };
  const response = await api.get("/admin/quality-controls", { params });
  return response.data;
}

export async function getQualityControl(id) {
  const response = await api.get(`/admin/quality-controls/${id}`);
  return response.data.data;
}

export async function createQualityControl(data) {
  const response = await api.post("/admin/quality-controls", data);
  return response.data.data;
}

/** entries dan extras bersifat ganti semua. */
export async function updateQualityControl(id, data) {
  const response = await api.patch(`/admin/quality-controls/${id}`, data);
  return response.data.data;
}

export async function updateQualityControlStatus(id, status) {
  const response = await api.patch(`/admin/quality-controls/${id}/status`, {
    status,
  });
  return response.data.data;
}

export async function deleteQualityControl(id) {
  const response = await api.delete(`/admin/quality-controls/${id}`);
  return response.data.data;
}

/** data: { kind: "PHOTO" | "VIDEO", content_type } */
export async function requestQcMediaUpload(id, data) {
  const response = await api.post(
    `/admin/quality-controls/${id}/media/upload-url`,
    data,
  );
  return response.data.data;
}

/** data: { kind, path } */
export async function registerQcMedia(id, data) {
  const response = await api.post(`/admin/quality-controls/${id}/media`, data);
  return response.data.data;
}

export async function deleteQcMedia(id, mediaId) {
  const response = await api.delete(
    `/admin/quality-controls/${id}/media/${mediaId}`,
  );
  return response.data.data;
}

/** GET /admin/qc-items. section dan is_active opsional. */
export async function getQcItems({ section, is_active } = {}) {
  const params = {
    ...(hasValue(section) && { section }),
    ...(is_active !== undefined && is_active !== "" && { is_active }),
  };
  const response = await api.get("/admin/qc-items", { params });
  return response.data.data;
}

export async function createQcItem(data) {
  const response = await api.post("/admin/qc-items", data);
  return response.data.data;
}

export async function updateQcItem(id, data) {
  const response = await api.patch(`/admin/qc-items/${id}`, data);
  return response.data.data;
}

export async function deleteQcItem(id) {
  const response = await api.delete(`/admin/qc-items/${id}`);
  return response.data.data;
}
