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
export async function createEmployee({
  name,
  email,
  display_id,
  job_title,
  bank_name,
  account_number,
  account_holder,
}) {
  const response = await api.post("/owner/employees", {
    name,
    email,
    display_id,
    job_title,
    bank_name,
    account_number,
    account_holder,
  });

  return response.data.data;
}
/**
 * PUT /owner/employees/:id
 * Minimal satu dari: name, email, is_active.
 * Mengganti email mereset verifikasi & PIN dan mengirim tautan baru (`email_sent`).
 */
export async function updateEmployee(
  id,
  {
    name,
    email,
    is_active,
    display_id,
    job_title,
    bank_name,
    account_holder,
    account_number,
  },
) {
  const body = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(job_title !== undefined && { job_title }),
    ...(bank_name !== undefined && { bank_name }),
    ...(account_holder !== undefined && { account_holder }),
    ...(account_number !== undefined && { account_number }),
    ...(display_id !== undefined && { display_id }),
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
export async function deleteEmployee(id) {
  const { data } = await api.delete(`/owner/employees/${id}`);
  return data.data;
}
