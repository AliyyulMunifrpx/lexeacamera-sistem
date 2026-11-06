import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /owner/employees
 * search, status (ALL | ACTIVE | INACTIVE), page. 20 per halaman.
 * Mengembalikan { data, paging }.
 */
export async function getEmployees({ search, status, page = 1 } = {}) {
  const params = {
    ...(hasValue(search) && { search }),
    ...(hasValue(status) && status !== "ALL" && { status }),
    page,
  };

  const response = await api.get("/owner/employees", { params });

  return response.data;
}

/** GET /owner/employees/:id */
export async function getEmployee(id) {
  const response = await api.get(`/owner/employees/${id}`);

  return response.data.data;
}

/** POST /owner/employees. Mengembalikan karyawan + `email_sent`. */
export async function createEmployee({ name, email }) {
  const response = await api.post("/owner/employees", { name, email });

  return response.data.data;
}

/**
 * PUT /owner/employees/:id
 * Minimal satu dari: name, email, is_active.
 * Mengganti email mereset verifikasi & PIN dan mengirim tautan baru (`email_sent`).
 */
export async function updateEmployee(id, { name, email, is_active }) {
  const body = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(is_active !== undefined && { is_active }),
  };

  const response = await api.put(`/owner/employees/${id}`, body);

  return response.data.data;
}

/** POST /owner/employees/:id/resend-verification (maks 1x per menit). */
export async function resendEmployeeVerification(id) {
  const response = await api.post(`/owner/employees/${id}/resend-verification`);

  return response.data.data;
}
