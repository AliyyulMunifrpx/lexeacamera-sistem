import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => hasValue(value)),
  );
}

/**
 * GET /owner/payrolls
 * params: employee_id, status (PENDING|PAID), date_from, date_to, search, page
 * Mengembalikan { data, summary: {paid_amount, pending_amount}, paging }.
 */
export async function getPayrolls(params = {}) {
  const response = await api.get("/owner/payrolls", {
    params: cleanParams(params),
  });
  return response.data;
}

/** GET /owner/employees/:id/payrolls (tanpa employee_id di query) */
export async function getEmployeePayrolls(employeeId, params = {}) {
  const { employee_id: _ignored, ...rest } = params;
  const response = await api.get(`/owner/employees/${employeeId}/payrolls`, {
    params: cleanParams(rest),
  });
  return response.data;
}

/** GET /owner/payrolls/:id */
export async function getPayroll(id) {
  const response = await api.get(`/owner/payrolls/${id}`);
  return response.data.data;
}

/** POST /owner/payrolls */
export async function createPayroll(payload) {
  const response = await api.post("/owner/payrolls", payload);
  return response.data.data;
}

/** PATCH /owner/payrolls/:id (hanya slip PENDING) */
export async function updatePayroll({ id, data }) {
  const response = await api.patch(`/owner/payrolls/${id}`, data);
  return response.data.data;
}

/** PATCH /owner/payrolls/:id/status  { status, disbursement_date? } */
export async function updatePayrollStatus({ id, data }) {
  const response = await api.patch(`/owner/payrolls/${id}/status`, data);
  return response.data.data;
}

/** PATCH /owner/payrolls/:id/items/:itemId  { checked } */
export async function togglePayrollItem({ id, itemId, checked }) {
  const response = await api.patch(`/owner/payrolls/${id}/items/${itemId}`, {
    checked,
  });
  return response.data.data;
}

/** DELETE /owner/payrolls/:id (hanya slip PENDING) */
export async function deletePayroll(id) {
  const response = await api.delete(`/owner/payrolls/${id}`);
  return response.data.data;
}
