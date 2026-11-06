import api, { apiServer } from "../../../lib/api/client.js";

/* Verifikasi email & buat PIN karyawan (tanpa login). */

/**
 * POST /public/employees/token-info
 * Mengembalikan { name, pin_set }. `pin_set: true` = tautan untuk mengganti PIN.
 */
export async function getEmployeeTokenInfo(token) {
  const response = await apiServer.post("/public/employees/token-info", {
    token,
  });

  return response.data.data;
}

/** POST /public/employees/set-pin. PIN 4-6 digit. Mengembalikan { name }. */
export async function setEmployeePin({ token, pin }) {
  const response = await apiServer.post("/public/employees/set-pin", {
    token,
    pin,
  });

  return response.data.data;
}

/* ---------- Absen (halaman /absen) ---------- */

/**
 * Halaman absen harus memanggil backend LANGSUNG (bukan lewat proxy "/api"),
 * supaya backend melihat IP perangkat, bukan IP server Next.js.
 * Butuh CORS di backend untuk origin frontend.
 */
const DIRECT = () => ({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: false,
});

/** GET /public/attendance/employees -> [{ id, name }] */
export async function getAttendanceEmployees() {
  const response = await apiServer.get(
    "/public/attendance/employees",
    DIRECT(),
  );

  return response.data.data;
}

/**
 * POST /public/attendance/check-in
 * Mengembalikan { type, employee, at }.
 */
export async function checkIn({ employee_id, pin }) {
  const response = await apiServer.post(
    "/public/attendance/check-in",
    { employee_id, pin },
    DIRECT(),
  );

  return response.data.data;
}

/**
 * POST /public/attendance/check-out
 * Mengembalikan { type, employee, at, check_in_at, duration_minutes }.
 */
export async function checkOut({ employee_id, pin }) {
  const response = await apiServer.post(
    "/public/attendance/check-out",
    { employee_id, pin },
    DIRECT(),
  );

  return response.data.data;
}
/**
 * GET /public/attendance/today
 * Status absen semua karyawan hari ini (WIB). Hanya dari wifi toko.
 * Response: { data: { date, summary, employees } }
 */
export async function getAttendanceToday() {
  const response = await apiServer.get("/public/attendance/today", DIRECT());
  return response.data.data;
}

/**
 * POST /public/attendance/history
 * Riwayat absen milik sendiri per bulan. Wajib PIN.
 * @param {{ employee_id: string, pin: string, month?: string }} payload
 */
export async function getAttendanceHistory(payload) {
  const response = await apiServer.post(
    "/public/attendance/history",
    payload,
    DIRECT(),
  );
  return response.data.data;
}
