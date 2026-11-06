import api from "../../../lib/api/client.js";

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /owner/admins
 * search, status (ALL | ACTIVE | INACTIVE), page. 20 per halaman, urut nama.
 * Mengembalikan { data, paging }.
 */
export async function getAdmins({ search, status, page = 1 } = {}) {
  const params = {
    ...(hasValue(search) && { search }),
    ...(hasValue(status) && status !== "ALL" && { status }),
    page,
  };

  const response = await api.get("/owner/admins", { params });

  return response.data;
}

/** GET /owner/admins/:id. Objek admin + `invite_accepted` (true | false | null). */
export async function getAdmin(id) {
  const response = await api.get(`/owner/admins/${id}`);

  return response.data.data;
}

/**
 * POST /owner/admins. Mengundang admin lewat email.
 * `attendance` (boolean) bawaan true di backend; selalu dikirim eksplisit.
 */
export async function createAdmin({ name, email, attendance = true }) {
  const response = await api.post("/owner/admins", { name, email, attendance });

  return response.data.data;
}

/**
 * PATCH /owner/admins/:id
 * Minimal satu dari: is_active, attendance. (Nama sengaja tidak dikirim dari
 * sini: admin mengubah namanya sendiri.)
 */
export async function updateAdmin(id, { is_active, attendance }) {
  const body = {
    ...(is_active !== undefined && { is_active }),
    ...(attendance !== undefined && { attendance }),
  };

  const response = await api.patch(`/owner/admins/${id}`, body);

  return response.data.data;
}

/** POST /owner/admins/:id/resend-invite. Mengembalikan { id, email, email_sent }. */
export async function resendAdminInvite(id) {
  const response = await api.post(`/owner/admins/${id}/resend-invite`);

  return response.data.data;
}
