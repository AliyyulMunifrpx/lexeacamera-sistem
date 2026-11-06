"use client";

import { useState } from "react";
import { FiDownload, FiLoader } from "react-icons/fi";

import notify from "../../lib/notify.js";
import { normalizeApiError } from "../../lib/api/errors.js";
import { getAttendancesForExport } from "../../app/features/attendances/api.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* -------------------------------- Formatters ------------------------------ */

function formatDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })}`.replace(".", ":");
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} mnt`;
  if (rest === 0) return `${hours} jam`;
  return `${hours} jam ${rest} mnt`;
}

const STATUS_LABEL = {
  DONE: "Selesai",
  OPEN: "Di toko",
  MISSED: "Lupa absen pulang",
};

/* --------------------------------- Export -------------------------------- */

function buildRows(records) {
  return records.map((record) => ({
    Karyawan: record.employee?.name ?? "",
    Tanggal: formatDay(record.check_in_at),
    Masuk: formatTime(record.check_in_at),
    Pulang: formatTime(record.check_out_at),
    Durasi: formatDuration(record.duration_minutes),
    Status: STATUS_LABEL[record.status] ?? record.status ?? "",
    "Jam masuk (ISO)": record.check_in_at ?? "",
    "Jam pulang (ISO)": record.check_out_at ?? "",
  }));
}

function buildFileName({ dateFrom, dateTo }) {
  const parts = ["rekap-absen"];
  if (dateFrom) parts.push(dateFrom);
  if (dateTo) parts.push(dateTo);
  if (!dateFrom && !dateTo) parts.push("semua");
  return `${parts.join("-")}.xlsx`;
}

async function exportAttendancesExcel(filters) {
  const records = await getAttendancesForExport(filters);

  const XLSX = await import("xlsx");

  const ws = XLSX.utils.json_to_sheet(buildRows(records));

  // Lebar kolom agar rapi saat dibuka di Excel.
  ws["!cols"] = [
    { wch: 24 }, // Karyawan
    { wch: 18 }, // Tanggal
    { wch: 8 }, // Masuk
    { wch: 8 }, // Pulang
    { wch: 16 }, // Durasi
    { wch: 20 }, // Status
    { wch: 24 }, // Jam masuk ISO
    { wch: 24 }, // Jam pulang ISO
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Absen");
  XLSX.writeFile(wb, buildFileName(filters));
}

/* -------------------------------- Component ------------------------------ */

export default function ExportAttendancesButton({
  employeeId,
  dateFrom,
  dateTo,
  disabled = false,
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    try {
      await exportAttendancesExcel({
        employee_id: employeeId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      notify.success("File rekap absen berhasil diunduh.");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message || "Gagal membuat file Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting || disabled}
      aria-busy={exporting}
      className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
    >
      {exporting ? (
        <>
          <FiLoader
            className="animate-spin motion-reduce:animate-none"
            size={16}
            aria-hidden="true"
          />
          Menyiapkan…
        </>
      ) : (
        <>
          <FiDownload size={16} aria-hidden="true" />
          Export Excel
        </>
      )}
    </button>
  );
}
