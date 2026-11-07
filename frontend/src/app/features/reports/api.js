import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/* from & to (YYYY-MM-DD, WIB) harus dikirim berpasangan atau tidak sama sekali. */
function periodParams({ from, to } = {}) {
  return hasValue(from) && hasValue(to) ? { from, to } : {};
}

/**
 * GET /owner/reports/summary
 * Mengembalikan { period, sales, refunds, net }.
 */
export async function getReportSummary(filters = {}) {
  const response = await api.get("/owner/reports/summary", {
    params: periodParams(filters),
  });

  return response.data.data;
}

/**
 * GET /owner/reports/trend  (group, from, to wajib)
 * group: day (maks 366 hari) | week (maks 1100) | month (maks 3700).
 * Mengembalikan { group, from, to, data: [{ date, sales, refunds, net }] }.
 */
export async function getReportTrend({ group, from, to }) {
  const response = await api.get("/owner/reports/trend", {
    params: { group, from, to },
  });

  return response.data.data;
}

/**
 * GET /owner/reports/products
 * sort: units | revenue | profit, limit 1-100, page.
 * Mengembalikan { data, paging, period, sort }.
 */
export async function getReportProducts({
  from,
  to,
  sort,
  search,
  limit,
  page,
} = {}) {
  const response = await api.get("/owner/reports/products", {
    params: {
      ...periodParams({ from, to }),
      ...(hasValue(sort) && { sort }),
      ...(hasValue(search) && { search }),
      ...(hasValue(limit) && { limit }),
      ...(hasValue(page) && { page }),
    },
  });

  return response.data;
}
/**
 * GET /owner/reports/categories (tanpa paging)
 * sort: units | revenue | profit. Mengembalikan { period, sort, data }.
 */
export async function getReportCategories({ from, to, sort } = {}) {
  const response = await api.get("/owner/reports/categories", {
    params: {
      ...periodParams({ from, to }),
      ...(hasValue(sort) && { sort }),
    },
  });

  return response.data;
}

/**
 * GET /owner/reports/customers
 * sort: revenue | orders | profit, limit 1-100, page.
 * Mengembalikan { data, paging, period, sort }.
 */
export async function getReportCustomers({ from, to, sort, limit, page } = {}) {
  const response = await api.get("/owner/reports/customers", {
    params: {
      ...periodParams({ from, to }),
      ...(hasValue(sort) && { sort }),
      ...(hasValue(limit) && { limit }),
      ...(hasValue(page) && { page }),
    },
  });

  return response.data;
}

/**
 * GET /owner/reports/customers/summary  (from & to wajib)
 * Mengembalikan { period, active_customers, repeat_rate_pct, new, returning, unassigned }.
 */
export async function getReportCustomersSummary({ from, to }) {
  const response = await api.get("/owner/reports/customers/summary", {
    params: { from, to },
  });

  return response.data.data;
}
/**
 * GET /owner/reports/transactions
 * Satu baris per order lunas (SALE/REFUND) di periode.
 * Query: from, to, type, search, limit (1-1000), page.
 * Response: { period, data, totals, paging }.
 */
export async function getReportTransactions({
  from,
  to,
  type,
  search,
  product,
  category_id,
  camera_id,
  limit,
  page,
} = {}) {
  const response = await api.get("/owner/reports/transactions", {
    params: {
      ...periodParams({ from, to }),
      ...(hasValue(type) && { type }),
      ...(hasValue(search) && { search }),
      ...(hasValue(product) && { product }),
      ...(hasValue(category_id) && { category_id }),
      ...(hasValue(camera_id) && { camera_id }),
      ...(hasValue(limit) && { limit }),
      ...(hasValue(page) && { page }),
    },
  });

  return response.data;
}
/**
 * GET /owner/reports/stock-value
 * Nilai persediaan saat ini (posisi hari ini, bukan per periode).
 * Response: { data: { as_of, stock, by_category, purchased } }.
 */
export async function getReportStockValue() {
  const response = await api.get("/owner/reports/stock-value");
  return response.data.data;
}
