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
  formatMoney,
  methodLabel,
  needsProof,
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

/* Kolom ringkasan (A..T). Rumus mengacu ke huruf kolom di bawah ini. */
const SUMMARY_HEADERS = [
  { label: "No", width: 6, align: "center" }, // A
  { label: "Tanggal", width: 14, align: "center" }, // B
  { label: "Saldo awal tunai", width: 16, align: "right" }, // C
  { label: "Saldo awal non tunai", width: 16, align: "right" }, // D
  { label: "Masuk tunai", width: 16, align: "right" }, // E
  { label: "Keluar tunai", width: 16, align: "right" }, // F
  { label: "Masuk non tunai", width: 16, align: "right" }, // G
  { label: "Keluar non tunai", width: 16, align: "right" }, // H
  { label: "Saldo akhir tunai", width: 17, align: "right" }, // I
  { label: "Saldo akhir non tunai", width: 17, align: "right" }, // J
  { label: "Saldo akhir total", width: 18, align: "right" }, // K
  { label: "Setor tunai", width: 16, align: "right" }, // L
  { label: "Setor transfer", width: 16, align: "right" }, // M
  { label: "Sisa tunai", width: 16, align: "right" }, // N
  { label: "Sisa non tunai", width: 16, align: "right" }, // O
  { label: "Sisa total", width: 17, align: "right" }, // P
  { label: "Jumlah baris", width: 12, align: "right" }, // Q
  { label: "Status setoran", width: 16, align: "center" }, // R
  { label: "Waktu setor", width: 22, align: "center" }, // S
  { label: "Bukti", width: 12, align: "center" }, // T
];

const ENTRY_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Tanggal", width: 14, align: "center" },
  { label: "Metode", width: 12, align: "center" },
  { label: "Atas nama", width: 26, align: "left" },
  { label: "Keterangan", width: 38, align: "left" },
  { label: "Masuk", width: 16, align: "right" },
  { label: "Keluar", width: 16, align: "right" },
  { label: "Saldo (tunai + non tunai)", width: 20, align: "right" },
];

const DETAIL_HEADERS = [
  { label: "No", width: 6, align: "center" }, // A
  { label: "Metode", width: 12, align: "center" }, // B
  { label: "Atas nama", width: 26, align: "left" }, // C
  { label: "Keterangan", width: 34, align: "left" }, // D
  { label: "Masuk", width: 16, align: "right" }, // E
  { label: "Keluar", width: 16, align: "right" }, // F
  { label: "Saldo", width: 18, align: "right" }, // G
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

const num = (value) => Number(value) || 0;

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

  if (filters.remitted === "true") parts.push("Sudah disetor");
  if (filters.remitted === "false") parts.push("Belum disetor");

  return parts.length > 0 ? parts.join(", ") : "Semua laporan";
}

/* Angka satu laporan. Setoran hanya dihitung kalau sudah dicentang disetor. */
function figures(report) {
  const openingCash = num(report.opening_cash);
  const openingNoncash = num(report.opening_noncash);
  const cashIn = num(report.cash_in);
  const cashOut = num(report.cash_out);
  const noncashIn = num(report.noncash_in);
  const noncashOut = num(report.noncash_out);

  const closingCash = Number.isFinite(Number(report.closing_cash))
    ? Number(report.closing_cash)
    : openingCash + cashIn - cashOut;
  const closingNoncash = Number.isFinite(Number(report.closing_noncash))
    ? Number(report.closing_noncash)
    : openingNoncash + noncashIn - noncashOut;

  const remitCash = report.remitted ? num(report.remit_cash) : 0;
  const remitTransfer = report.remitted ? num(report.remit_transfer) : 0;

  return {
    openingCash,
    openingNoncash,
    cashIn,
    cashOut,
    noncashIn,
    noncashOut,
    closingCash,
    closingNoncash,
    remitCash,
    remitTransfer,
    remainingCash: closingCash - remitCash,
    remainingNoncash: closingNoncash - remitTransfer,
  };
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
    sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    sheet.mergeCells(rowNumber, 4, rowNumber, lastColumn);

    const labelCell = sheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = {
      bold: true,
      size: 10,
      color: { argb: XLSX_COLORS.title },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "left" };

    const valueCell = sheet.getCell(rowNumber, 4);
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
  row.height = 32;
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
  workbook.creator = "Laporan Harian";
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

  // Saldo awal, saldo akhir, dan sisa tidak dijumlahkan: sisa satu hari menjadi
  // saldo awal hari berikutnya, jadi penjumlahannya menghitung dobel.
  const sums = reports.reduce(
    (total, report) => {
      const f = figures(report);
      return {
        cashIn: total.cashIn + f.cashIn,
        cashOut: total.cashOut + f.cashOut,
        noncashIn: total.noncashIn + f.noncashIn,
        noncashOut: total.noncashOut + f.noncashOut,
        remitCash: total.remitCash + f.remitCash,
        remitTransfer: total.remitTransfer + f.remitTransfer,
        entries: total.entries + num(report.entry_count),
      };
    },
    {
      cashIn: 0,
      cashOut: 0,
      noncashIn: 0,
      noncashOut: 0,
      remitCash: 0,
      remitTransfer: 0,
      entries: 0,
    },
  );

  const remittedCount = reports.filter((report) => report.remitted).length;
  const missingProof = reports.filter(
    (report) => report.remitted && needsProof(report) && !report.has_proof,
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
      "Status setoran",
      `${formatNumber(remittedCount)} sudah disetor, ${formatNumber(
        reports.length - remittedCount,
      )} belum disetor`,
    ],
  ];

  const metaStart = 5;
  const headerRow = metaStart + meta.length + 1;
  const lastColumn = SUMMARY_HEADERS.length;

  const sheet = createSheet(
    workbook,
    "Ringkasan Laporan",
    "Laporan Harian",
    SUMMARY_HEADERS,
    headerRow,
  );

  writeTitle(
    sheet,
    lastColumn,
    "LAPORAN HARIAN",
    "Kas harian dipisah tunai dan non tunai: saldo awal, pemasukan, pengeluaran, setoran ke owner, dan sisa yang belum disetor.",
  );
  writeMeta(sheet, metaStart, lastColumn, meta);
  writeHeaderRow(sheet, headerRow, SUMMARY_HEADERS);

  const firstRow = headerRow + 1;

  reports.forEach((report, index) => {
    const r = firstRow + index;
    const f = figures(report);

    const row = sheet.getRow(r);
    row.values = [
      index + 1,
      dateCell(report.date),
      f.openingCash,
      f.openingNoncash,
      f.cashIn,
      f.cashOut,
      f.noncashIn,
      f.noncashOut,
      { formula: `C${r}+E${r}-F${r}`, result: f.closingCash },
      { formula: `D${r}+G${r}-H${r}`, result: f.closingNoncash },
      { formula: `I${r}+J${r}`, result: f.closingCash + f.closingNoncash },
      f.remitCash,
      f.remitTransfer,
      { formula: `I${r}-L${r}`, result: f.remainingCash },
      { formula: `J${r}-M${r}`, result: f.remainingNoncash },
      {
        formula: `N${r}+O${r}`,
        result: f.remainingCash + f.remainingNoncash,
      },
      num(report.entry_count),
      report.remitted ? "Sudah disetor" : "Belum disetor",
      report.remitted ? formatDateTime(report.remitted_at) : "-",
      report.has_proof ? "Ada" : "Belum ada",
    ];

    styleDataRow(row, SUMMARY_HEADERS, index);

    row.getCell(2).numFmt = XLSX_DATE;
    for (let col = 3; col <= 16; col += 1) {
      row.getCell(col).numFmt = XLSX_RUPIAH;
    }
    row.getCell(17).numFmt = XLSX_NUMBER;

    [5, 7].forEach(
      (col) =>
        (row.getCell(col).font = { color: { argb: XLSX_COLORS.income } }),
    );
    [6, 8].forEach(
      (col) =>
        (row.getCell(col).font = { color: { argb: XLSX_COLORS.danger } }),
    );
    [9, 10, 11, 16].forEach(
      (col) =>
        (row.getCell(col).font = {
          bold: true,
          color: { argb: XLSX_COLORS.title },
        }),
    );

    row.getCell(18).font = report.remitted
      ? { bold: true, color: { argb: XLSX_COLORS.income } }
      : { color: { argb: XLSX_COLORS.muted } };

    if (!report.has_proof) {
      row.getCell(20).font =
        report.remitted && needsProof(report)
          ? { bold: true, color: { argb: XLSX_COLORS.danger } }
          : { color: { argb: XLSX_COLORS.muted } };
    }
  });

  const lastRow = firstRow + reports.length - 1;
  const totalRowNumber = lastRow + 1;
  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 2);
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = `Total (${formatNumber(reports.length)} laporan)`;

  [
    [5, "E", sums.cashIn, XLSX_RUPIAH],
    [6, "F", sums.cashOut, XLSX_RUPIAH],
    [7, "G", sums.noncashIn, XLSX_RUPIAH],
    [8, "H", sums.noncashOut, XLSX_RUPIAH],
    [12, "L", sums.remitCash, XLSX_RUPIAH],
    [13, "M", sums.remitTransfer, XLSX_RUPIAH],
    [17, "Q", sums.entries, XLSX_NUMBER],
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
    "• Saldo akhir tunai = saldo awal tunai + masuk tunai − keluar tunai. Saldo akhir non tunai dihitung dengan cara yang sama.",
    "• Tunai hanya disetor tunai, non tunai hanya disetor lewat transfer. Sisa = saldo akhir − setoran, dan menjadi saldo awal laporan berikutnya.",
    "• Saldo awal, saldo akhir, dan sisa tidak dijumlahkan karena sisa satu hari menjadi saldo awal hari berikutnya.",
    "• Laporan yang belum disetor dihitung belum menyetor apa pun, sehingga sisanya sama dengan saldo akhir.",
    includeEntries
      ? "• Rincian setiap baris pemasukan dan pengeluaran ada di sheet “Rincian Kas”."
      : "• Rincian baris tidak disertakan karena jumlah laporan terlalu banyak. Persempit filter atau ekspor per laporan.",
  ];
  const warningIndexes = includeEntries ? [] : [5];

  if (missingProof > 0) {
    notes.push(
      `• ${formatNumber(missingProof)} laporan sudah disetor dengan transfer tetapi belum ada bukti transfer.`,
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
      `${formatNumber(flat.length)} baris dari ${formatNumber(reports.length)} laporan. Saldo adalah saldo berjalan gabungan tunai dan non tunai pada laporan masing-masing.`,
    );
    writeHeaderRow(entrySheet, entryHeaderRow, ENTRY_HEADERS);

    const firstEntryRow = entryHeaderRow + 1;
    let incomeSum = 0;
    let expenseSum = 0;

    flat.forEach(({ report, entry }, index) => {
      const income = num(entry.income);
      const expense = num(entry.expense);

      incomeSum += income;
      expenseSum += expense;

      const row = entrySheet.getRow(firstEntryRow + index);
      row.values = [
        index + 1,
        dateCell(entry.date ?? report.date),
        methodLabel(entry.method),
        text(entry.name),
        text(entry.note),
        income,
        expense,
        num(entry.balance),
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
  const f = figures(report);
  const openingTotal = f.openingCash + f.openingNoncash;

  const workbook = await createWorkbook();

  const proofLabel = report.proof
    ? "Ada"
    : needsProof(report)
      ? "Belum ada (wajib untuk setoran transfer)"
      : "Belum ada";

  const meta = [
    ["Tanggal laporan", formatDate(report.date)],
    [
      "Status setoran",
      report.remitted
        ? `Sudah disetor (${formatDateTime(report.remitted_at)})`
        : "Belum disetor",
    ],
    [
      "Setoran",
      report.remitted
        ? `Tunai ${formatMoney(f.remitCash)} · Transfer ${formatMoney(f.remitTransfer)}`
        : "Belum disetor",
    ],
    ["Bukti transfer", proofLabel],
    ["Diekspor pada", formatExportTimestamp()],
  ];

  const metaStart = 5;
  const headerRow = metaStart + meta.length + 1;
  const lastColumn = DETAIL_HEADERS.length;

  const sheet = createSheet(
    workbook,
    "Laporan Harian",
    "Laporan Harian",
    DETAIL_HEADERS,
    headerRow,
    "portrait",
  );

  writeTitle(sheet, lastColumn, "LAPORAN HARIAN", formatDate(report.date));
  writeMeta(sheet, metaStart, lastColumn, meta);
  writeHeaderRow(sheet, headerRow, DETAIL_HEADERS);

  /* Baris saldo awal (gabungan) */
  const openingRowNumber = headerRow + 1;
  const openingRow = sheet.getRow(openingRowNumber);
  openingRow.values = [
    "",
    "",
    "Saldo awal",
    `Tunai ${formatMoney(f.openingCash)} · Non tunai ${formatMoney(f.openingNoncash)}`,
    "",
    "",
    openingTotal,
  ];
  styleDataRow(openingRow, DETAIL_HEADERS, 0, [4]);
  openingRow.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > lastColumn) return;
    cell.fill = solidFill(XLSX_COLORS.tint);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.title } };
  });
  openingRow.getCell(7).numFmt = XLSX_RUPIAH;

  /* Baris catatan kas: saldo berjalan sebagai rumus */
  let incomeSum = 0;
  let expenseSum = 0;

  entries.forEach((entry, index) => {
    const rowNumber = openingRowNumber + 1 + index;
    const income = num(entry.income);
    const expense = num(entry.expense);

    incomeSum += income;
    expenseSum += expense;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      methodLabel(entry.method),
      text(entry.name),
      text(entry.note),
      income,
      expense,
      {
        formula: `G${rowNumber - 1}+E${rowNumber}-F${rowNumber}`,
        result: num(entry.balance),
      },
    ];

    styleDataRow(row, DETAIL_HEADERS, index, [3, 4]);

    row.getCell(3).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    row.getCell(5).numFmt = XLSX_RUPIAH_DASH;
    row.getCell(6).numFmt = XLSX_RUPIAH_DASH;
    row.getCell(7).numFmt = XLSX_RUPIAH;

    if (income > 0) {
      row.getCell(5).font = { bold: true, color: { argb: XLSX_COLORS.income } };
    }
    if (expense > 0) {
      row.getCell(6).font = { bold: true, color: { argb: XLSX_COLORS.danger } };
    }
    row.getCell(7).font = { bold: true, color: { argb: XLSX_COLORS.title } };
  });

  /* Saldo akhir gabungan */
  const lastRow = openingRowNumber + entries.length;
  const totalRowNumber = lastRow + 1;

  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 4);
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "Saldo akhir (tunai + non tunai)";

  [
    [5, "E", incomeSum],
    [6, "F", expenseSum],
  ].forEach(([col, letter, result]) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${openingRowNumber + 1}:${letter}${lastRow})`,
      result,
    };
    cell.numFmt = XLSX_RUPIAH;
  });

  totalRow.getCell(7).value = {
    formula: `G${openingRowNumber}+E${totalRowNumber}-F${totalRowNumber}`,
    result: f.closingCash + f.closingNoncash,
  };
  totalRow.getCell(7).numFmt = XLSX_RUPIAH;
  styleTotalRow(totalRow, lastColumn);

  /* Rincian per metode, setoran, dan sisa */
  const breakdown = [
    ["Saldo akhir tunai", f.closingCash],
    ["Saldo akhir non tunai", f.closingNoncash],
    [
      report.remitted ? "Disetor tunai" : "Disetor tunai (belum disetor)",
      f.remitCash,
    ],
    [
      report.remitted ? "Disetor transfer" : "Disetor transfer (belum disetor)",
      f.remitTransfer,
    ],
    ["Sisa belum disetor (tunai)", f.remainingCash],
    ["Sisa belum disetor (non tunai)", f.remainingNoncash],
    ["Sisa belum disetor (total)", f.remainingCash + f.remainingNoncash],
  ];

  breakdown.forEach(([label, value], index) => {
    const rowNumber = totalRowNumber + 1 + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, 6);
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = label;
    row.getCell(7).value = value;
    row.getCell(7).numFmt = XLSX_RUPIAH;
    styleTotalRow(row, lastColumn);
  });

  const notesStart = totalRowNumber + breakdown.length + 2;
  const notes = [
    "Catatan:",
    "• Saldo dihitung berjalan dari saldo awal (tunai + non tunai) mengikuti urutan pencatatan.",
    "• Tunai hanya disetor tunai, non tunai hanya disetor lewat transfer. Sisa belum disetor menjadi saldo awal laporan berikutnya.",
    report.remitted
      ? "• Laporan sudah disetor dan terkunci."
      : "• Laporan belum disetor, sehingga sisanya sama dengan saldo akhir.",
  ];
  const warningIndexes = [];

  if (entries.length === 0) {
    notes.push(
      "• Belum ada baris pemasukan atau pengeluaran pada laporan ini.",
    );
  }
  if (report.remitted && needsProof(report) && !report.proof) {
    notes.push(
      "• Setoran transfer sudah disetor tetapi belum ada bukti transfer.",
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(sheet, notesStart, lastColumn, notes, warningIndexes);

  await downloadWorkbook(workbook, `laporan-harian_${report.date}.xlsx`);
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
