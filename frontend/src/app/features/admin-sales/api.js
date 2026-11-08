import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /admin/sales (ADMIN atau OWNER)
 * Hanya order lunas, berdasarkan tanggal lunas (WIB). Tanpa modal, laba, margin.
 *
 * period: day (default) | week | month | year | range | all
 * - day/week/month/year: `date` (YYYY-MM-DD) opsional, default hari ini (WIB).
 * - range: `from` dan `to` wajib. `date` dilarang.
 * - all: tanpa date/from/to (dilarang).
 * Parameter yang dilarang tidak dikirim agar tidak ditolak 400.
 *
 * Mengembalikan { period: {type, from, to}, sales: {orders, units, revenue},
 * refunds: {orders, units, amount}, net: {units, revenue} }.
 */
export async function getAdminSales({ period = "day", date, from, to } = {}) {
  const params = { period };

  if (period === "range") {
    params.from = from;
    params.to = to;
  } else if (period !== "all" && hasValue(date)) {
    params.date = date;
  }

  const response = await api.get("/admin/sales", { params });

  return response.data.data;
}
