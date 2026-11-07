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

/* -------------------------------- Constants ------------------------------- */

const STATUS_LABEL = {
  DONE: "Selesai",
  OPEN: "Di toko",
  MISSED: "Lupa absen pulang",
};

const XLSX_COLORS = {
  brand: "FF4F46E5",
  brandText: "FFFFFFFF",
  title: "FF1E1B4B",
  muted: "FF6B7280",
  zebra: "FFF5F5FB",
  border: "FFD9D9E3",
  total: "FFE8E8F5",
  done: "FF047857",
  open: "FF4F46E5",
  missed: "FFB91C1C",
};

const STATUS_COLOR = {
  DONE: XLSX_COLORS.done,
  OPEN: XLSX_COLORS.open,
  MISSED: XLSX_COLORS.missed,
};

const XLSX_NUMBER = "#,##0";
const XLSX_DATE = "dd mmm yyyy";
const XLSX_CLOCK = "hh:mm";
const XLSX_DURATION = "[h]:mm";

const LOG_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Karyawan", width: 28, align: "left" },
  { label: "Tanggal", width: 18, align: "center" },
  { label: "Jam masuk (WIB)", width: 16, align: "center" },
  { label: "Jam pulang (WIB)", width: 16, align: "center" },
  { label: "Durasi (jam:menit)", width: 18, align: "center" },
  { label: "Status", width: 22, align: "center" },
];

const SUMMARY_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Karyawan", width: 28, align: "left" },
  { label: "Total sesi", width: 12, align: "right" },
  { label: "Selesai", width: 12, align: "right" },
  { label: "Lupa absen pulang", width: 18, align: "right" },
  { label: "Di toko", width: 12, align: "right" },
  { label: "Total durasi (jam:menit)", width: 24, align: "center" },
  { label: "Rata-rata durasi", width: 18, align: "center" },
];

const THIN_BORDER = {
  top: { style: "thin", color: { argb: XLSX_COLORS.border } },
  left: { style: "thin", color: { argb: XLSX_COLORS.border } },
  bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
  right: { style: "thin", color: { argb: XLSX_COLORS.border } },
};

/* -------------------------------- Helpers --------------------------------- */

function solidFill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function parseDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDayLabel(value) {
  return new Date(parseDay(value)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriodText(dateFrom, dateTo) {
  if (dateFrom && dateTo) {
    const days =
      Math.round((parseDay(dateTo) - parseDay(dateFrom)) / 86400000) + 1;
    return `${formatDayLabel(dateFrom)} – ${formatDayLabel(dateTo)} (${days} hari)`;
  }
  if (dateFrom) return `Mulai ${formatDayLabel(dateFrom)}`;
  if (dateTo) return `Sampai ${formatDayLabel(dateTo)}`;
  return "Semua tanggal";
}

function formatExportTimestamp() {
  const text = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${text} WIB`;
}

// Geser +7 jam supaya Excel (yang membaca tanggal sebagai UTC) menampilkan jam WIB.
function toWibCellDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

// Menit -> pecahan hari, supaya Excel bisa menjumlah dan memformatnya sebagai jam:menit.
function toDurationCell(minutes) {
  return typeof minutes === "number" ? minutes / 1440 : "-";
}

function buildFileName({ date_from: dateFrom, date_to: dateTo }) {
  const parts = ["rekap-absen"];
  if (dateFrom) parts.push(dateFrom);
  if (dateTo) parts.push(dateTo);
  if (!dateFrom && !dateTo) parts.push("semua");
  return `${parts.join("-")}.xlsx`;
}

/* ------------------------------ Sheet builders ---------------------------- */

function createSheet(workbook, name, footerLabel, headers, headerRowNumber) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: headerRowNumber, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    headerFooter: { oddFooter: `&L${footerLabel}&RHalaman &P dari &N` },
  });
  sheet.columns = headers.map((column) => ({ width: column.width }));
  return sheet;
}

function writeTitle(sheet, lastColumn, title, subtitle) {
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 18, bold: true, color: { argb: XLSX_COLORS.title } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = {
    size: 10,
    italic: true,
    color: { argb: XLSX_COLORS.muted },
  };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
}

function writeHeaderRow(sheet, rowNumber, headers) {
  const row = sheet.getRow(rowNumber);
  row.height = 26;
  headers.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: XLSX_COLORS.brandText } };
    cell.fill = solidFill(XLSX_COLORS.brand);
    cell.alignment = {
      vertical: "middle",
      horizontal: column.align === "left" ? "left" : "center",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });
}

function styleDataRow(row, headers, index) {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > headers.length) return;
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: headers[col - 1].align,
    };
    if (index % 2 === 1) cell.fill = solidFill(XLSX_COLORS.zebra);
  });
}

function styleTotalRow(row, lastColumn, { first = true } = {}) {
  row.height = 24;
  for (let col = 1; col <= lastColumn; col += 1) {
    const cell = row.getCell(col);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.title } };
    cell.fill = solidFill(XLSX_COLORS.total);
    cell.border = {
      ...THIN_BORDER,
      ...(first
        ? { top: { style: "medium", color: { argb: XLSX_COLORS.brand } } }
        : {}),
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col === 1 ? "left" : "center",
    };
  }
}

function writeNotes(sheet, startRow, lastColumn, notes) {
  notes.forEach((text, index) => {
    const rowNumber = startRow + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = text;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.font =
      index === 0
        ? { bold: true, size: 10, color: { argb: XLSX_COLORS.title } }
        : { size: 10, color: { argb: XLSX_COLORS.muted } };
  });
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* --------------------------------- Export -------------------------------- */

function summarizeByEmployee(records) {
  const map = new Map();

  records.forEach((record) => {
    const name = record.employee?.name ?? "Tanpa nama";
    const key = record.employee?.id ?? name;
    const entry = map.get(key) ?? {
      name,
      total: 0,
      done: 0,
      missed: 0,
      open: 0,
      minutes: 0,
    };

    entry.total += 1;
    if (record.status === "DONE") entry.done += 1;
    if (record.status === "MISSED") entry.missed += 1;
    if (record.status === "OPEN") entry.open += 1;
    if (typeof record.duration_minutes === "number") {
      entry.minutes += record.duration_minutes;
    }

    map.set(key, entry);
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

async function exportAttendancesExcel(filters) {
  const records = await getAttendancesForExport(filters);

  if (!records || records.length === 0) {
    throw new Error("Tidak ada data absen untuk diekspor.");
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rekap Absen";
  workbook.created = new Date();

  const periodText = formatPeriodText(filters.date_from, filters.date_to);
  const employeeLabel = filters.employee_id
    ? (records[0]?.employee?.name ?? "Karyawan dipilih")
    : "Semua karyawan";

  const doneCount = records.filter((r) => r.status === "DONE").length;
  const openCount = records.filter((r) => r.status === "OPEN").length;
  const missedCount = records.filter((r) => r.status === "MISSED").length;

  /* ===================== Sheet 1: Rekap Absen ===================== */

  const meta = [
    ["Periode", periodText],
    ["Karyawan", employeeLabel],
    ["Diekspor pada", formatExportTimestamp()],
    [
      "Cakupan data",
      `${formatNumber(records.length)} sesi (${formatNumber(doneCount)} selesai, ${formatNumber(openCount)} di toko, ${formatNumber(missedCount)} lupa absen pulang)`,
    ],
  ];

  const logHeaderRow = 4 + meta.length + 1;
  const logLastColumn = LOG_HEADERS.length;
  const logSheet = createSheet(
    workbook,
    "Rekap Absen",
    "Rekap Absen",
    LOG_HEADERS,
    logHeaderRow,
  );

  writeTitle(
    logSheet,
    logLastColumn,
    "REKAP ABSEN KARYAWAN",
    "Catatan jam masuk dan pulang karyawan. Semua waktu dalam WIB.",
  );

  meta.forEach(([label, value], index) => {
    const rowNumber = 4 + index;
    logSheet.mergeCells(rowNumber, 1, rowNumber, 2);
    logSheet.mergeCells(rowNumber, 3, rowNumber, logLastColumn);

    const labelCell = logSheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = {
      bold: true,
      size: 10,
      color: { argb: XLSX_COLORS.title },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "left" };

    const valueCell = logSheet.getCell(rowNumber, 3);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });

  writeHeaderRow(logSheet, logHeaderRow, LOG_HEADERS);

  const firstLogRow = logHeaderRow + 1;
  let totalFraction = 0;
  let durationCount = 0;

  records.forEach((record, index) => {
    const duration = toDurationCell(record.duration_minutes);
    if (typeof duration === "number") {
      totalFraction += duration;
      durationCount += 1;
    }

    const row = logSheet.getRow(firstLogRow + index);
    row.values = [
      index + 1,
      record.employee?.name ?? "-",
      toWibCellDate(record.check_in_at),
      toWibCellDate(record.check_in_at),
      toWibCellDate(record.check_out_at),
      duration,
      STATUS_LABEL[record.status] ?? record.status ?? "-",
    ];

    styleDataRow(row, LOG_HEADERS, index);

    row.getCell(3).numFmt = XLSX_DATE;
    row.getCell(4).numFmt = XLSX_CLOCK;
    row.getCell(5).numFmt = XLSX_CLOCK;
    row.getCell(6).numFmt = XLSX_DURATION;
    row.getCell(2).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    row.getCell(7).font = {
      bold: true,
      color: { argb: STATUS_COLOR[record.status] ?? XLSX_COLORS.muted },
    };
  });

  const lastLogRow = firstLogRow + records.length - 1;

  // Total durasi
  const totalRowNumber = lastLogRow + 1;
  logSheet.mergeCells(totalRowNumber, 1, totalRowNumber, 5);
  const totalRow = logSheet.getRow(totalRowNumber);
  totalRow.getCell(1).value =
    `Total durasi (${formatNumber(records.length)} sesi)`;
  totalRow.getCell(6).value = {
    formula: `SUM(F${firstLogRow}:F${lastLogRow})`,
    result: totalFraction,
  };
  totalRow.getCell(6).numFmt = XLSX_DURATION;
  styleTotalRow(totalRow, logLastColumn);

  // Rata-rata durasi sesi yang punya durasi
  const avgRowNumber = totalRowNumber + 1;
  logSheet.mergeCells(avgRowNumber, 1, avgRowNumber, 5);
  const avgRow = logSheet.getRow(avgRowNumber);
  avgRow.getCell(1).value = "Rata-rata durasi per sesi selesai";
  avgRow.getCell(6).value =
    durationCount > 0
      ? {
          formula: `AVERAGE(F${firstLogRow}:F${lastLogRow})`,
          result: totalFraction / durationCount,
        }
      : "-";
  avgRow.getCell(6).numFmt = XLSX_DURATION;
  styleTotalRow(avgRow, logLastColumn, { first: false });

  writeNotes(logSheet, avgRowNumber + 2, logLastColumn, [
    "Catatan:",
    "• Durasi hanya ada untuk sesi yang sudah punya jam pulang. Sesi “Di toko” dan “Lupa absen pulang” tidak punya durasi dan tidak masuk total maupun rata-rata.",
    "• Tanggal dihitung dari waktu absen masuk. Semua waktu mengikuti zona waktu WIB.",
    "• Ringkasan per karyawan ada di sheet “Rekap Karyawan”.",
  ]);

  logSheet.autoFilter = {
    from: { row: logHeaderRow, column: 1 },
    to: { row: lastLogRow, column: logLastColumn },
  };

  /* =================== Sheet 2: Rekap Karyawan =================== */

  const employees = summarizeByEmployee(records);
  const summaryHeaderRow = 4;
  const summaryLastColumn = SUMMARY_HEADERS.length;
  const summarySheet = createSheet(
    workbook,
    "Rekap Karyawan",
    "Rekap Karyawan",
    SUMMARY_HEADERS,
    summaryHeaderRow,
  );

  writeTitle(
    summarySheet,
    summaryLastColumn,
    "REKAP PER KARYAWAN",
    `${periodText} • ${formatNumber(employees.length)} karyawan`,
  );

  writeHeaderRow(summarySheet, summaryHeaderRow, SUMMARY_HEADERS);

  const firstSummaryRow = summaryHeaderRow + 1;
  let allMinutes = 0;

  employees.forEach((employee, index) => {
    allMinutes += employee.minutes;

    const row = summarySheet.getRow(firstSummaryRow + index);
    row.values = [
      index + 1,
      employee.name,
      employee.total,
      employee.done,
      employee.missed,
      employee.open,
      employee.minutes / 1440,
      employee.done > 0 ? employee.minutes / employee.done / 1440 : "-",
    ];

    styleDataRow(row, SUMMARY_HEADERS, index);

    [3, 4, 5, 6].forEach((col) => (row.getCell(col).numFmt = XLSX_NUMBER));
    row.getCell(7).numFmt = XLSX_DURATION;
    row.getCell(8).numFmt = XLSX_DURATION;
    row.getCell(2).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    if (employee.missed > 0) {
      row.getCell(5).font = { bold: true, color: { argb: XLSX_COLORS.missed } };
    }
  });

  const lastSummaryRow = firstSummaryRow + employees.length - 1;
  const summaryTotalRowNumber = lastSummaryRow + 1;
  summarySheet.mergeCells(summaryTotalRowNumber, 1, summaryTotalRowNumber, 2);
  const summaryTotalRow = summarySheet.getRow(summaryTotalRowNumber);
  summaryTotalRow.getCell(1).value = "Total";

  const totals = {
    3: records.length,
    4: doneCount,
    5: missedCount,
    6: openCount,
  };
  const letters = { 3: "C", 4: "D", 5: "E", 6: "F", 7: "G" };

  Object.entries(totals).forEach(([col, result]) => {
    const letter = letters[col];
    const cell = summaryTotalRow.getCell(Number(col));
    cell.value = {
      formula: `SUM(${letter}${firstSummaryRow}:${letter}${lastSummaryRow})`,
      result,
    };
    cell.numFmt = XLSX_NUMBER;
  });

  summaryTotalRow.getCell(7).value = {
    formula: `SUM(G${firstSummaryRow}:G${lastSummaryRow})`,
    result: allMinutes / 1440,
  };
  summaryTotalRow.getCell(7).numFmt = XLSX_DURATION;
  summaryTotalRow.getCell(8).value =
    doneCount > 0 ? allMinutes / doneCount / 1440 : "-";
  summaryTotalRow.getCell(8).numFmt = XLSX_DURATION;
  styleTotalRow(summaryTotalRow, summaryLastColumn);

  writeNotes(summarySheet, summaryTotalRowNumber + 2, summaryLastColumn, [
    "Catatan:",
    "• Rata-rata durasi = total durasi dibagi jumlah sesi selesai.",
    "• “Lupa absen pulang” berwarna merah perlu diperbaiki lewat halaman Rekap Absen.",
  ]);

  summarySheet.autoFilter = {
    from: { row: summaryHeaderRow, column: 1 },
    to: { row: lastSummaryRow, column: summaryLastColumn },
  };

  await downloadWorkbook(workbook, buildFileName(filters));
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
