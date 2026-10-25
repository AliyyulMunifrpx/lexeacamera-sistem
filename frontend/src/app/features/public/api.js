import api from "../../../lib/api/client.js";

export async function getHome() {
  const response = await api.get("/public/home");
  return response.data.data;
}
export async function getCamera(id) {
  const response = await api.get(`/public/cameras/${id}`);
  return response.data.data;
}

export async function getCameras(filters = {}) {
  const {
    search,
    category_id,
    condition,
    min_price,
    max_price,
    promo,
    best_selling,
    sort,
    page = 1,
  } = filters;

  const hasValue = (value) =>
    value !== undefined && value !== null && value !== "";

  const trimmedSearch = typeof search === "string" ? search.trim() : "";

  const params = {
    ...(trimmedSearch && { search: trimmedSearch.slice(0, 100) }),
    ...(hasValue(category_id) && { category_id }),
    ...(hasValue(condition) && { condition }),
    ...(hasValue(min_price) && { min_price }),
    ...(hasValue(max_price) && { max_price }),
    ...(hasValue(promo) && { promo }),
    ...(hasValue(best_selling) && { best_selling }),
    ...(hasValue(sort) && { sort }),
    page,
  };

  const response = await api.get("/public/cameras", { params });

  // { data: [...], paging: { page, per_page, total, total_pages } }
  return response.data;
}
export async function createOrder(payload) {
  const response = await api.post("/orders", payload);

  // { data: { no_invoice, customer_name, total_amount, created_at, items: [...] } }
  return response.data;
}
