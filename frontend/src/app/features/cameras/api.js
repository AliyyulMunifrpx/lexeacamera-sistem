import api from "../../../lib/api/client.js";

export async function getCameras({
  search,
  min_price,
  max_price,
  category_id,
  condition,
  page = 1,
}) {
  const params = {
    ...(search && { search }),
    ...(min_price !== "" && min_price != null && { min_price }),
    ...(max_price !== "" && max_price != null && { max_price }),
    ...(category_id && { category_id }),
    ...(condition && { condition }),
    page,
  };

  const response = await api.get("/cameras", { params });

  return response.data;
}
export async function createCamera(formData) {
  const response = await api.post("/cameras", formData);

  return response.data.data;
}
export async function getCamera(id) {
  const response = await api.get(`/cameras/${id}`, {});
  console.log(response.data.data);
  return response.data.data;
}
export async function deleteCamera(id) {
  const response = await api.delete(`/cameras/${id}`, {});
  console.log(response.data.data);
  return response.data.data;
}
export async function updateCamera(id, data) {
  const response = await api.patch(`/cameras/${id}`, data);

  return response.data.data;
}

export async function updateCameraImages(id, formData) {
  const response = await api.patch(`/cameras/${id}/images`, formData);

  return response.data.data;
}
