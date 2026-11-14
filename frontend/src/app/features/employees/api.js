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
  contract_start,
  contract_end,
}) {
  const response = await api.post("/owner/employees", {
    name,
    email,
    display_id,
    job_title,
    bank_name,
    account_number,
    account_holder,
    ...(contract_start !== undefined && { contract_start }),
    ...(contract_end !== undefined && { contract_end }),
  });

  return response.data.data;
}

/**
 * PUT /owner/employees/:id
 * Minimal satu field. Mengganti email mereset verifikasi & PIN dan mengirim tautan baru (`email_sent`).
 * contract_start / contract_end: "YYYY-MM-DD" atau null (mengosongkan).
 /**
 * PUT /owner/employees/:id
 * Minimal satu field. Mengganti email mereset verifikasi & PIN dan mengirim tautan baru (`email_sent`).
 * Kontrak diatur lewat endpoint kontrak, bukan di sini.
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

/** GET /owner/employees/:id/contracts */
export async function getEmployeeContracts(id) {
  const response = await api.get(`/owner/employees/${id}/contracts`);
  return response.data.data;
}

/** POST /owner/employees/:id/contracts. data: { start_date, end_date?, note? } */
export async function createEmployeeContract(id, data) {
  const response = await api.post(`/owner/employees/${id}/contracts`, data);
  return response.data.data;
}

/** PUT /owner/employees/:id/contracts/:contractId */
export async function updateEmployeeContract(id, contractId, data) {
  const response = await api.put(
    `/owner/employees/${id}/contracts/${contractId}`,
    data,
  );
  return response.data.data;
}

/** DELETE /owner/employees/:id/contracts/:contractId */
export async function deleteEmployeeContract(id, contractId) {
  const response = await api.delete(
    `/owner/employees/${id}/contracts/${contractId}`,
  );
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
