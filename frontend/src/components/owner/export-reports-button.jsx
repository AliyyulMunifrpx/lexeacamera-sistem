"use client";

import { useState } from "react";
import { FiDownload, FiLoader } from "react-icons/fi";

// ASUMSI: instance axios yang sama dengan hooks.js. Sesuaikan jika path-nya beda.
import {
  BTN_BASE,
  FOCUS_RING,
  describeError,
  formatDate,
  formatDateTime,
  todayWib,
} from "./daily-reports-shared.jsx";
import api from "../../lib/api/client.js";
import notify from "../../lib/notify.js";

/* -------------------------------- Constants ------------------------------- */

const BASE = "/admin/daily-reports";
const MAX_PAGES = 50; // 50 halaman x 20 laporan
const BATCH_SIZE = 5;
// Rincian kas butuh 1 request per laporan, jadi dibatasi.
const MAX_DETAIL_REPORTS = 200;

/* Palet sama dengan invoice PDF: marun tua #3a0718 dan marun #6c1b30. */
const XLSX_COLORS = {
  dark: "FF3A0718",
  accent: "FF6C1B30",
  onDark: "FFF0DAE1",
  white: "FFFFFFFF",
  title: "FF3A0718",
  muted: "FF666666",
  zebra: "FFFAF5F7",
  tint: "FFFAF1F4",
  border: "FFD9D9D9",
  income: "FF15803D",
  danger: "FFB91C1C",
  warning: "FFB45309",
};

const XLSX_RUPIAH = '"Rp" #,##0;[Red]-"Rp" #,##0';
// Nol tampil sebagai "-", nilainya tetap angka supaya SUM tetap benar.
const XLSX_RUPIAH_DASH = '"Rp" #,##0;[Red]-"Rp" #,##0;"-"';
const XLSX_NUMBER = "#,##0";
const XLSX_DATE = "dd/mm/yyyy";

const SUMMARY_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Tanggal", width: 14, align: "center" },
  { label: "Kasir", width: 22, align: "left" },
  { label: "Saldo awal", width: 16, align: "right" },
  { label: "Total masuk", width: 16, align: "right" },
  { label: "Total keluar", width: 16, align: "right" },
  { label: "Saldo akhir", width: 18, align: "right" },
  { label: "Jumlah baris", width: 12, align: "right" },
  { label: "Status transfer", width: 18, align: "center" },
  { label: "Waktu transfer", width: 22, align: "center" },
  { label: "Bukti transfer", width: 14, align: "center" },
];

const ENTRY_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Tanggal", width: 14, align: "center" },
  { label: "Kasir", width: 22, align: "left" },
  { label: "Atas nama", width: 26, align: "left" },
  { label: "Keterangan", width: 38, align: "left" },
  { label: "Masuk", width: 16, align: "right" },
  { label: "Keluar", width: 16, align: "right" },
  { label: "Saldo", width: 18, align: "right" },
];

const DETAIL_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Atas nama", width: 28, align: "left" },
  { label: "Keterangan", width: 42, align: "left" },
  { label: "Masuk", width: 16, align: "right" },
  { label: "Keluar", width: 16, align: "right" },
  { label: "Saldo", width: 18, align: "right" },
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

function text(value) {
  const result = typeof value === "string" ? value.trim() : value;
  return result === null || result === undefined || result === ""
    ? "-"
    : result;
}

// "2026-11-17" -> Date UTC tengah malam, supaya tanggal di Excel tidak bergeser.
function dateCell(value) {
  return new Date(`${value}T00:00:00Z`);
}

// "2026-11-17" -> "17/11/2026"
function shortDate(value) {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function formatExportTimestamp() {
  const stamp = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${stamp} WIB`;
}

function describeFilters(filters = {}) {
  const parts = [];

  if (filters.date_from || filters.date_to) {
    parts.push(
      `Periode ${filters.date_from ? shortDate(filters.date_from) : "awal"} s/d ${
        filters.date_to ? shortDate(filters.date_to) : "sekarang"
      }`,
    );
  }

  if (filters.transferred === "true") parts.push("Sudah transfer");
  if (filters.transferred === "false") parts.push("Belum transfer");
  if (filters.cashier) parts.push(`Kasir: ${filters.cashier}`);

  return parts.length > 0 ? parts.join(", ") : "Semua laporan";
}

/* ------------------------------ Data fetching ----------------------------- */

function cleanParams(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== ""),
  );
}

async function fetchPage(params, page) {
  const response = await api.get(BASE, { params: { ...params, page } });
  return response.data;
}

// Mengambil SEMUA laporan yang cocok dengan filter, bukan hanya halaman terbuka.
async function fetchAllReports(filters) {
  const params = cleanParams(filters);
  const first = await fetchPage(params, 1);
  const rows = [...(first?.data ?? [])];

  const totalAll = first?.paging?.total ?? rows.length;
  const totalPages = Math.min(first?.paging?.total_pages ?? 1, MAX_PAGES);

  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) pages.push(page);

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      pages.slice(i, i + BATCH_SIZE).map((page) => fetchPage(params, page)),
    );
    results.forEach((result) => rows.push(...(result?.data ?? [])));
  }

  const seen = new Set();
  const reports = rows.filter((report) => {
    if (seen.has(report.id)) return false;
    seen.add(report.id);
    return true;
  });

  return { reports, totalAll };
}

async function fetchDetails(reports) {
  const details = [];

  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      reports
        .slice(i, i + BATCH_SIZE)
        .map((report) =>
          api.get(`${BASE}/${report.id}`).then((res) => res.data.data),
        ),
    );
    details.push(...results);
  }

  return details;
}

/* ------------------------------ Sheet builders ---------------------------- */

function createSheet(
  workbook,
  name,
  footerLabel,
  headers,
  headerRowNumber,
  orientation = "landscape",
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: headerRowNumber, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation,
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

/* Band marun tua di atas (judul + subjudul) dan strip aksen, seperti header PDF. */
function writeTitle(sheet, lastColumn, title, subtitle) {
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 18, bold: true, color: { argb: XLSX_COLORS.white } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { size: 10, color: { argb: XLSX_COLORS.onDark } };
  subtitleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    indent: 1,
  };
  sheet.getRow(2).height = 20;

  for (let col = 1; col <= lastColumn; col += 1) {
    sheet.getCell(1, col).fill = solidFill(XLSX_COLORS.dark);
    sheet.getCell(2, col).fill = solidFill(XLSX_COLORS.dark);
  }

  sheet.mergeCells(3, 1, 3, lastColumn);
  sheet.getCell(3, 1).fill = solidFill(XLSX_COLORS.accent);
  sheet.getRow(3).height = 4;
}

function writeMeta(sheet, startRow, lastColumn, meta) {
  meta.forEach(([label, value], index) => {
    const rowNumber = startRow + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, 2);
    sheet.mergeCells(rowNumber, 3, rowNumber, lastColumn);

    const labelCell = sheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = {
      bold: true,
      size: 10,
      color: { argb: XLSX_COLORS.title },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "left" };

    const valueCell = sheet.getCell(rowNumber, 3);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });
}

function writeHeaderRow(sheet, rowNumber, headers) {
  const row = sheet.getRow(rowNumber);
  row.height = 26;
  headers.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: XLSX_COLORS.white } };
    cell.fill = solidFill(XLSX_COLORS.dark);
    cell.alignment = {
      vertical: "middle",
      horizontal: column.align === "left" ? "left" : "center",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });
}

function styleDataRow(row, headers, index, wrapColumns = []) {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > headers.length) return;
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: "middle",
      horizontal: headers[col - 1].align,
      wrapText: wrapColumns.includes(col),
    };
    if (index % 2 === 1) cell.fill = solidFill(XLSX_COLORS.zebra);
  });
}

function styleTotalRow(row, lastColumn) {
  row.height = 24;
  for (let col = 1; col <= lastColumn; col += 1) {
    const cell = row.getCell(col);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.title } };
    cell.fill = solidFill(XLSX_COLORS.tint);
    cell.border = {
      ...THIN_BORDER,
      top: { style: "medium", color: { argb: XLSX_COLORS.accent } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col === 1 ? "left" : "right",
    };
  }
}

function writeNotes(sheet, startRow, lastColumn, notes, warningIndexes = []) {
  notes.forEach((note, index) => {
    const rowNumber = startRow + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = note;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.font =
      index === 0
        ? { bold: true, size: 10, color: { argb: XLSX_COLORS.title } }
        : {
            size: 10,
            color: {
              argb: warningIndexes.includes(index)
                ? XLSX_COLORS.warning
                : XLSX_COLORS.muted,
            },
          };
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

async function createWorkbook() {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Laporan Harian Kasir";
  workbook.created = new Date();
  return workbook;
}

/* ------------------------- Export: banyak laporan ------------------------- */

async function exportReportsExcel(filters) {
  const { reports, totalAll } = await fetchAllReports(filters);

  if (reports.length === 0) {
    throw new Error("Belum ada laporan untuk diekspor.");
  }

  const truncated = totalAll > reports.length;
  const includeEntries = reports.length <= MAX_DETAIL_REPORTS;
  const details = includeEntries ? await fetchDetails(reports) : [];

  const sums = reports.reduce(
    (total, report) => ({
      opening: total.opening + (Number(report.opening_balance) || 0),
      income: total.income + (Number(report.total_in) || 0),
      expense: total.expense + (Number(report.total_out) || 0),
      closing: total.closing + (Number(report.closing_balance) || 0),
      entries: total.entries + (Number(report.entry_count) || 0),
    }),
    { opening: 0, income: 0, expense: 0, closing: 0, entries: 0 },
  );

  const transferredCount = reports.filter(
    (report) => report.transferred,
  ).length;
  const missingProof = reports.filter(
    (report) => report.transferred && !report.has_proof,
  ).length;

  const workbook = await createWorkbook();

  /* ===================== Sheet 1: Ringkasan Laporan ===================== */

  const meta = [
    ["Diekspor pada", formatExportTimestamp()],
    ["Filter", describeFilters(filters)],
    [
      "Cakupan data",
      truncated
        ? `${formatNumber(reports.length)} dari ${formatNumber(totalAll)} laporan`
        : `${formatNumber(reports.length)} laporan`,
    ],
    [
      "Status transfer",
      `${formatNumber(transferredCount)} sudah transfer, ${formatNumber(
        reports.length - transferredCount,
      )} belum transfer`,
    ],
  ];

  const metaStart = 5;
  const headerRow = metaStart + meta.length + 1;
  const lastColumn = SUMMARY_HEADERS.length;

  const sheet = createSheet(
    workbook,
    "Ringkasan Laporan",
    "Laporan Harian Kasir",
    SUMMARY_HEADERS,
    headerRow,
  );

  writeTitle(
    sheet,
    lastColumn,
    "LAPORAN HARIAN KASIR",
    "Ringkasan kas harian: saldo awal, pemasukan, pengeluaran, dan saldo akhir yang ditransfer ke owner.",
  );
  writeMeta(sheet, metaStart, lastColumn, meta);
  writeHeaderRow(sheet, headerRow, SUMMARY_HEADERS);

  const firstRow = headerRow + 1;

  reports.forEach((report, index) => {
    const rowNumber = firstRow + index;
    const opening = Number(report.opening_balance) || 0;
    const income = Number(report.total_in) || 0;
    const expense = Number(report.total_out) || 0;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      dateCell(report.date),
      text(report.cashier_name),
      opening,
      income,
      expense,
      {
        formula: `D${rowNumber}+E${rowNumber}-F${rowNumber}`,
        result: Number(report.closing_balance) || opening + income - expense,
      },
      Number(report.entry_count) || 0,
      report.transferred ? "Sudah transfer" : "Belum transfer",
      report.transferred ? formatDateTime(report.transferred_at) : "-",
      report.has_proof ? "Ada" : "Belum ada",
    ];

    styleDataRow(row, SUMMARY_HEADERS, index);

    row.getCell(2).numFmt = XLSX_DATE;
    row.getCell(3).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    [4, 5, 6, 7].forEach((col) => (row.getCell(col).numFmt = XLSX_RUPIAH));
    row.getCell(8).numFmt = XLSX_NUMBER;

    row.getCell(5).font = { color: { argb: XLSX_COLORS.income } };
    row.getCell(6).font = { color: { argb: XLSX_COLORS.danger } };
    row.getCell(7).font = { bold: true, color: { argb: XLSX_COLORS.title } };

    row.getCell(9).font = report.transferred
      ? { bold: true, color: { argb: XLSX_COLORS.income } }
      : { color: { argb: XLSX_COLORS.muted } };

    if (!report.has_proof) {
      row.getCell(11).font = report.transferred
        ? { bold: true, color: { argb: XLSX_COLORS.danger } }
        : { color: { argb: XLSX_COLORS.muted } };
    }
  });

  const lastRow = firstRow + reports.length - 1;
  const totalRowNumber = lastRow + 1;
  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 3);
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = `Total (${formatNumber(reports.length)} laporan)`;

  [
    [4, "D", sums.opening, XLSX_RUPIAH],
    [5, "E", sums.income, XLSX_RUPIAH],
    [6, "F", sums.expense, XLSX_RUPIAH],
    [7, "G", sums.closing, XLSX_RUPIAH],
    [8, "H", sums.entries, XLSX_NUMBER],
  ].forEach(([col, letter, result, numFmt]) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${firstRow}:${letter}${lastRow})`,
      result,
    };
    cell.numFmt = numFmt;
  });
  styleTotalRow(totalRow, lastColumn);

  const notes = [
    "Catatan:",
    "• Saldo akhir = saldo awal + total masuk − total keluar, yaitu uang yang ditransfer ke owner.",
    includeEntries
      ? "• Rincian setiap baris pemasukan dan pengeluaran ada di sheet “Rincian Kas”."
      : "• Rincian baris tidak disertakan karena jumlah laporan terlalu banyak. Persempit filter atau ekspor per laporan.",
  ];
  const warningIndexes = includeEntries ? [] : [2];

  if (missingProof > 0) {
    notes.push(
      `• ${formatNumber(missingProof)} laporan sudah ditandai transfer tetapi belum ada bukti transfer.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  if (truncated) {
    notes.push(
      `• Hanya ${formatNumber(reports.length)} dari ${formatNumber(totalAll)} laporan yang berhasil diekspor.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(sheet, totalRowNumber + 2, lastColumn, notes, warningIndexes);

  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: lastRow, column: lastColumn },
  };

  /* ======================= Sheet 2: Rincian Kas ======================= */

  if (includeEntries) {
    const flat = details.flatMap((report) =>
      (report.entries ?? []).map((entry) => ({ report, entry })),
    );

    const entryHeaderRow = 5;
    const entryLastColumn = ENTRY_HEADERS.length;
    const entrySheet = createSheet(
      workbook,
      "Rincian Kas",
      "Rincian Kas",
      ENTRY_HEADERS,
      entryHeaderRow,
    );

    writeTitle(
      entrySheet,
      entryLastColumn,
      "RINCIAN KAS",
      `${formatNumber(flat.length)} baris dari ${formatNumber(reports.length)} laporan. Saldo adalah saldo berjalan pada laporan masing-masing.`,
    );
    writeHeaderRow(entrySheet, entryHeaderRow, ENTRY_HEADERS);

    const firstEntryRow = entryHeaderRow + 1;
    let incomeSum = 0;
    let expenseSum = 0;

    flat.forEach(({ report, entry }, index) => {
      const income = Number(entry.income) || 0;
      const expense = Number(entry.expense) || 0;

      incomeSum += income;
      expenseSum += expense;

      const row = entrySheet.getRow(firstEntryRow + index);
      row.values = [
        index + 1,
        dateCell(entry.date ?? report.date),
        text(report.cashier_name),
        text(entry.name),
        text(entry.note),
        income,
        expense,
        Number(entry.balance) || 0,
      ];

      styleDataRow(row, ENTRY_HEADERS, index, [4, 5]);

      row.getCell(2).numFmt = XLSX_DATE;
      row.getCell(4).font = { bold: true, color: { argb: XLSX_COLORS.title } };
      row.getCell(6).numFmt = XLSX_RUPIAH_DASH;
      row.getCell(7).numFmt = XLSX_RUPIAH_DASH;
      row.getCell(8).numFmt = XLSX_RUPIAH;

      if (income > 0) {
        row.getCell(6).font = {
          bold: true,
          color: { argb: XLSX_COLORS.income },
        };
      }
      if (expense > 0) {
        row.getCell(7).font = {
          bold: true,
          color: { argb: XLSX_COLORS.danger },
        };
      }
      row.getCell(8).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    });

    if (flat.length === 0) {
      entrySheet.mergeCells(firstEntryRow, 1, firstEntryRow, entryLastColumn);
      const emptyCell = entrySheet.getCell(firstEntryRow, 1);
      emptyCell.value = "Belum ada baris pemasukan atau pengeluaran.";
      emptyCell.font = { italic: true, color: { argb: XLSX_COLORS.muted } };
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
      entrySheet.getRow(firstEntryRow).height = 24;
    } else {
      const lastEntryRow = firstEntryRow + flat.length - 1;
      const entryTotalRowNumber = lastEntryRow + 1;

      entrySheet.mergeCells(entryTotalRowNumber, 1, entryTotalRowNumber, 5);
      const entryTotalRow = entrySheet.getRow(entryTotalRowNumber);
      entryTotalRow.getCell(1).value =
        `Total (${formatNumber(flat.length)} baris)`;

      [
        [6, "F", incomeSum],
        [7, "G", expenseSum],
      ].forEach(([col, letter, result]) => {
        const cell = entryTotalRow.getCell(col);
        cell.value = {
          formula: `SUM(${letter}${firstEntryRow}:${letter}${lastEntryRow})`,
          result,
        };
        cell.numFmt = XLSX_RUPIAH;
      });
      styleTotalRow(entryTotalRow, entryLastColumn);

      entrySheet.autoFilter = {
        from: { row: entryHeaderRow, column: 1 },
        to: { row: lastEntryRow, column: entryLastColumn },
      };
    }
  }

  const from = filters?.date_from || "";
  const to = filters?.date_to || "";
  const range = from || to ? `${from || "awal"}_${to || "kini"}` : todayWib();

  await downloadWorkbook(workbook, `laporan-harian_${range}.xlsx`);
}

/* ------------------------- Export: satu laporan --------------------------- */

async function exportReportExcel(report) {
  const entries = report.entries ?? [];
  const opening = Number(report.opening_balance) || 0;

  const workbook = await createWorkbook();

  const meta = [
    ["Tanggal laporan", formatDate(report.date)],
    ["Kasir", text(report.cashier_name)],
    [
      "Status transfer",
      report.transferred
        ? `Sudah transfer (${formatDateTime(report.transferred_at)})`
        : "Belum transfer",
    ],
    ["Bukti transfer", report.proof ? "Ada" : "Belum ada"],
    ["Diekspor pada", formatExportTimestamp()],
  ];

  const metaStart = 5;
  const headerRow = metaStart + meta.length + 1;
  const lastColumn = DETAIL_HEADERS.length;

  const sheet = createSheet(
    workbook,
    "Laporan Harian",
    "Laporan Harian Kasir",
    DETAIL_HEADERS,
    headerRow,
    "portrait",
  );

  writeTitle(
    sheet,
    lastColumn,
    "LAPORAN HARIAN KASIR",
    `${formatDate(report.date)} · Kasir ${text(report.cashier_name)}`,
  );
  writeMeta(sheet, metaStart, lastColumn, meta);
  writeHeaderRow(sheet, headerRow, DETAIL_HEADERS);

  /* Baris saldo awal */
  const openingRowNumber = headerRow + 1;
  const openingRow = sheet.getRow(openingRowNumber);
  openingRow.values = ["", "Saldo awal", "", "", "", opening];
  styleDataRow(openingRow, DETAIL_HEADERS, 0);
  openingRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > lastColumn) return;
    cell.fill = solidFill(XLSX_COLORS.tint);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.title } };
  });
  openingRow.getCell(6).numFmt = XLSX_RUPIAH;

  /* Baris catatan kas: saldo berjalan sebagai rumus */
  let incomeSum = 0;
  let expenseSum = 0;

  entries.forEach((entry, index) => {
    const rowNumber = openingRowNumber + 1 + index;
    const income = Number(entry.income) || 0;
    const expense = Number(entry.expense) || 0;

    incomeSum += income;
    expenseSum += expense;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      text(entry.name),
      text(entry.note),
      income,
      expense,
      {
        formula: `F${rowNumber - 1}+D${rowNumber}-E${rowNumber}`,
        result: Number(entry.balance) || 0,
      },
    ];

    styleDataRow(row, DETAIL_HEADERS, index, [2, 3]);

    row.getCell(2).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    row.getCell(4).numFmt = XLSX_RUPIAH_DASH;
    row.getCell(5).numFmt = XLSX_RUPIAH_DASH;
    row.getCell(6).numFmt = XLSX_RUPIAH;

    if (income > 0) {
      row.getCell(4).font = { bold: true, color: { argb: XLSX_COLORS.income } };
    }
    if (expense > 0) {
      row.getCell(5).font = { bold: true, color: { argb: XLSX_COLORS.danger } };
    }
    row.getCell(6).font = { bold: true, color: { argb: XLSX_COLORS.title } };
  });

  /* Total */
  const lastRow = openingRowNumber + entries.length;
  const totalRowNumber = lastRow + 1;

  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 3);
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "Saldo akhir (ditransfer ke owner)";

  [
    [4, "D", incomeSum],
    [5, "E", expenseSum],
  ].forEach(([col, letter, result]) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${openingRowNumber}:${letter}${lastRow})`,
      result,
    };
    cell.numFmt = XLSX_RUPIAH;
  });

  totalRow.getCell(6).value = {
    formula: `F${openingRowNumber}+D${totalRowNumber}-E${totalRowNumber}`,
    result: Number(report.closing_balance) || opening + incomeSum - expenseSum,
  };
  totalRow.getCell(6).numFmt = XLSX_RUPIAH;
  styleTotalRow(totalRow, lastColumn);

  const notes = [
    "Catatan:",
    "• Saldo dihitung berjalan dari saldo awal mengikuti urutan pencatatan.",
    "• Saldo akhir = saldo awal + total masuk − total keluar.",
  ];
  const warningIndexes = [];

  if (entries.length === 0) {
    notes.push(
      "• Belum ada baris pemasukan atau pengeluaran pada laporan ini.",
    );
  }
  if (report.transferred && !report.proof) {
    notes.push(
      "• Laporan sudah ditandai transfer tetapi belum ada bukti transfer.",
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(sheet, totalRowNumber + 2, lastColumn, notes, warningIndexes);

  const cashierSlug = String(report.cashier_name || "kasir")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  await downloadWorkbook(
    workbook,
    `laporan-harian_${report.date}_${cashierSlug || "kasir"}.xlsx`,
  );
}

/* -------------------------------- Components ------------------------------ */

function ExportButton({ onExport, successMessage, disabled }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    try {
      await onExport();
      notify.success(successMessage);
    } catch (error) {
      notify.error(describeError(error) || "Gagal membuat file Excel.");
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

/* Halaman daftar: mengekspor semua laporan sesuai filter yang sedang diterapkan. */
export function ExportReportsButton({ filters, disabled = false }) {
  return (
    <ExportButton
      disabled={disabled}
      onExport={() => exportReportsExcel(filters)}
      successMessage="File laporan harian berhasil diunduh."
    />
  );
}

/* Halaman detail: mengekspor satu laporan (data sudah dimuat, tanpa request). */
export function ExportReportButton({ report, disabled = false }) {
  return (
    <ExportButton
      disabled={disabled}
      onExport={() => exportReportExcel(report)}
      successMessage="File laporan berhasil diunduh."
    />
  );
}
