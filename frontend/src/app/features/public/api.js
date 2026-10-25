import api from "../../../lib/api/client.js";

export async function getHome() {
  const response = await api.get("/public/home");
  return response.data.data;
}

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

  const response = await api.get("/public/cameras", { params });

  return response.data;
}
