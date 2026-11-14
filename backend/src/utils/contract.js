import { ResponseError } from "../error/response-error.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const FAR_FUTURE = "9999-12-31";

export const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
export const dateOut = (date) =>
  date ? date.toISOString().slice(0, 10) : null;
export const todayWib = () =>
  new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

// Tanggal akhir ikut dihitung (hari terakhir = sisa 0 hari).
export const contractStatus = (start, end, today = todayWib()) => {
  if (start > today) return "UPCOMING";
  if (end && end < today) return "ENDED";
  return "ACTIVE";
};

export const daysLeft = (end, today = todayWib()) =>
  end
    ? Math.round((toDate(end).getTime() - toDate(today).getTime()) / DAY_MS)
    : null;

/* Urut dari yang paling awal. contract_number = urutan itu (Kontrak 1, 2, ...). */
export const serializeContracts = (rows) => {
  const today = todayWib();

  return [...rows]
    .sort((a, b) => a.start_date - b.start_date)
    .map((row, index) => {
      const start = dateOut(row.start_date);
      const end = dateOut(row.end_date);

      return {
        id: row.id,
        employee_id: row.employee_id,
        contract_number: index + 1,
        start_date: start,
        end_date: end,
        note: row.note ?? null,
        status: contractStatus(start, end, today),
        days_left: daysLeft(end, today),
        created_at: row.created_at,
      };
    });
};

/* Kontrak yang jadi ringkasan karyawan: berjalan > akan datang > terakhir berakhir. */
export const currentContract = (list) =>
  list.find((item) => item.status === "ACTIVE") ??
  list.find((item) => item.status === "UPCOMING") ??
  list.at(-1) ??
  null;

export const assertContractPeriod = (start, end) => {
  if (start && end && end < start) {
    throw new ResponseError(400, "INVALID_CONTRACT_PERIOD");
  }
};

/* Kontrak tanpa tanggal akhir dianggap berjalan tanpa batas. */
export const periodsOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart <= (bEnd ?? FAR_FUTURE) && bStart <= (aEnd ?? FAR_FUTURE);
