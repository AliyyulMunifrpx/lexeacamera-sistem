import api from "../../../lib/api/client.js";

/** GET /admin/daily-reports/next-opening. date opsional (YYYY-MM-DD). */
export async function getNextOpening(date) {
  const response = await api.get("/admin/daily-reports/next-opening", {
    params: date ? { date } : {},
  });
  return response.data.data;
}
/** GET /admin/daily-reports/:id/history. Mengembalikan { data, paging }. */
export async function getReportHistory(id, { page = 1 } = {}) {
  const response = await api.get(`/admin/daily-reports/${id}/history`, {
    params: { page },
  });
  return response.data;
}
