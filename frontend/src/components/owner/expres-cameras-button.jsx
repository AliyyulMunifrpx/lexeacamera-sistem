"use client";

import { useState } from "react";
import { FiDownload, FiLoader } from "react-icons/fi";

import notify from "../../lib/notify.js";
import { normalizeApiError } from "../../lib/api/errors.js";
// ASUMSI: fungsi API daftar produk yang dipakai useGetCameras. Kalau namanya
// beda, cukup ganti baris import ini dan pemanggilannya di fetchAllCameras.
import { getCameras } from "../../app/features/cameras/api.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* -------------------------------- Constants ------------------------------- */

const LOW_STOCK_LIMIT = 3;
const MAX_PAGES = 200;
const BATCH_SIZE = 5;

const CONDITION_LABEL = { NEW: "Baru", SECOND: "Bekas" };

const XLSX_COLORS = {
  brand: "FF4F46E5",
  brandText: "FFFFFFFF",
  title: "FF1E1B4B",
  muted: "FF6B7280",
  zebra: "FFF5F5FB",
  border: "FFD9D9E3",
  total: "FFE8E8F5",
  profit: "FF047857",
  danger: "FFB91C1C",
  warning: "FFB45309",
};

const XLSX_RUPIAH = '"Rp" #,##0;[Red]-"Rp" #,##0';
const XLSX_NUMBER = "#,##0";

const PRODUCT_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Produk", width: 36, align: "left" },
  { label: "Kategori", width: 18, align: "left" },
  { label: "Kondisi", width: 10, align: "center" },
  { label: "SKU", width: 16, align: "left" },
  { label: "Serial number", width: 20, align: "left" },
  { label: "Warna", width: 14, align: "left" },
  { label: "Shutter count", width: 14, align: "right" },
  { label: "Stok", width: 8, align: "right" },
  { label: "Modal", width: 16, align: "right" },
  { label: "Harga jual", width: 16, align: "right" },
  { label: "Laba per unit", width: 16, align: "right" },
  { label: "Nilai stok (modal)", width: 20, align: "right" },
  { label: "Nilai stok (harga jual)", width: 22, align: "right" },
];

const CATEGORY_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Kategori", width: 28, align: "left" },
  { label: "Jumlah produk", width: 16, align: "right" },
  { label: "Total stok", width: 14, align: "right" },
  { label: "Produk stok habis", width: 18, align: "right" },
  { label: "Nilai stok (modal)", width: 22, align: "right" },
  { label: "Nilai stok (harga jual)", width: 24, align: "right" },
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

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  const result = typeof value === "string" ? value.trim() : value;
  return result === null || result === undefined || result === ""
    ? "-"
    : result;
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

function wibToday() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/* ------------------------------ Data fetching ----------------------------- */

// Mengambil SEMUA produk, bukan hanya halaman yang sedang dibuka.
async function fetchAllCameras() {
  const first = await getCameras({ page: 1 });
  const rows = [...(first?.data ?? [])];

  const totalAll = first?.paging?.total ?? rows.length;
  const totalPages = Math.min(first?.paging?.total_pages ?? 1, MAX_PAGES);

  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) pages.push(page);

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      pages.slice(i, i + BATCH_SIZE).map((page) => getCameras({ page })),
    );
    results.forEach((result) => rows.push(...(result?.data ?? [])));
  }

  // Jaga-jaga kalau data bergeser saat halaman diambil satu per satu.
  const seen = new Set();
  const unique = rows.filter((camera) => {
    if (seen.has(camera.id)) return false;
    seen.add(camera.id);
    return true;
  });

  return { cameras: unique, totalAll };
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
    cell.fill = solidFill(XLSX_COLORS.total);
    cell.border = {
      ...THIN_BORDER,
      top: { style: "medium", color: { argb: XLSX_COLORS.brand } },
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

/* --------------------------------- Export -------------------------------- */

function summarizeByCategory(cameras) {
  const map = new Map();

  cameras.forEach((camera) => {
    const name = camera.category?.name ?? "Tanpa kategori";
    const entry = map.get(name) ?? {
      name,
      products: 0,
      stock: 0,
      soldOut: 0,
      costValue: 0,
      sellValue: 0,
    };

    const stock = toNumber(camera.stock) ?? 0;
    const price = toNumber(camera.price) ?? 0;
    const capital = toNumber(camera.capital);

    entry.products += 1;
    entry.stock += stock;
    if (stock === 0) entry.soldOut += 1;
    entry.sellValue += stock * price;
    if (capital !== null) entry.costValue += stock * capital;

    map.set(name, entry);
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

async function exportCamerasExcel() {
  const { cameras, totalAll } = await fetchAllCameras();

  if (cameras.length === 0) {
    throw new Error("Belum ada produk untuk diekspor.");
  }

  const truncated = totalAll > cameras.length;
  const categories = summarizeByCategory(cameras);

  const soldOutCount = cameras.filter(
    (camera) => (toNumber(camera.stock) ?? 0) === 0,
  ).length;
  const lowStockCount = cameras.filter((camera) => {
    const stock = toNumber(camera.stock) ?? 0;
    return stock > 0 && stock <= LOW_STOCK_LIMIT;
  }).length;
  const missingCapital = cameras.filter(
    (camera) => toNumber(camera.capital) === null,
  ).length;

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Daftar Produk";
  workbook.created = new Date();

  /* ===================== Sheet 1: Daftar Produk ===================== */

  const meta = [
    ["Diekspor pada", formatExportTimestamp()],
    [
      "Cakupan data",
      truncated
        ? `${formatNumber(cameras.length)} dari ${formatNumber(totalAll)} produk`
        : `Semua produk (${formatNumber(cameras.length)} produk dalam ${formatNumber(categories.length)} kategori)`,
    ],
    [
      "Status stok",
      `${formatNumber(soldOutCount)} habis, ${formatNumber(lowStockCount)} menipis (maks. ${LOW_STOCK_LIMIT} unit)`,
    ],
  ];

  const headerRow = 4 + meta.length + 1;
  const lastColumn = PRODUCT_HEADERS.length;
  const sheet = createSheet(
    workbook,
    "Daftar Produk",
    "Daftar Produk",
    PRODUCT_HEADERS,
    headerRow,
  );

  writeTitle(
    sheet,
    lastColumn,
    "DAFTAR PRODUK",
    "Seluruh produk beserta stok, modal, harga jual, dan nilai persediaan.",
  );

  meta.forEach(([label, value], index) => {
    const rowNumber = 4 + index;
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

  writeHeaderRow(sheet, headerRow, PRODUCT_HEADERS);

  const firstRow = headerRow + 1;
  const sums = { stock: 0, costValue: 0, sellValue: 0 };

  cameras.forEach((camera, index) => {
    const rowNumber = firstRow + index;
    const stock = toNumber(camera.stock) ?? 0;
    const price = toNumber(camera.price) ?? 0;
    const capital = toNumber(camera.capital);
    const hasCapital = capital !== null;

    sums.stock += stock;
    sums.sellValue += stock * price;
    if (hasCapital) sums.costValue += stock * capital;

    const row = sheet.getRow(rowNumber);
    row.values = [
      index + 1,
      text(camera.name),
      text(camera.category?.name),
      CONDITION_LABEL[camera.condition] ?? text(camera.condition),
      text(camera.sku),
      text(camera.serial_number),
      text(camera.color),
      text(camera.shutter_count),
      stock,
      hasCapital ? capital : "-",
      price,
      hasCapital
        ? { formula: `K${rowNumber}-J${rowNumber}`, result: price - capital }
        : "-",
      hasCapital
        ? { formula: `I${rowNumber}*J${rowNumber}`, result: stock * capital }
        : "-",
      { formula: `I${rowNumber}*K${rowNumber}`, result: stock * price },
    ];

    styleDataRow(row, PRODUCT_HEADERS, index, [2]);

    row.getCell(2).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    row.getCell(9).numFmt = XLSX_NUMBER;
    [10, 11, 12, 13, 14].forEach(
      (col) => (row.getCell(col).numFmt = XLSX_RUPIAH),
    );

    if (stock === 0) {
      row.getCell(9).font = { bold: true, color: { argb: XLSX_COLORS.danger } };
    } else if (stock <= LOW_STOCK_LIMIT) {
      row.getCell(9).font = {
        bold: true,
        color: { argb: XLSX_COLORS.warning },
      };
    }

    if (hasCapital) {
      row.getCell(12).font = {
        bold: true,
        color: {
          argb: price - capital < 0 ? XLSX_COLORS.danger : XLSX_COLORS.profit,
        },
      };
    }
  });

  const lastRow = firstRow + cameras.length - 1;
  const totalRowNumber = lastRow + 1;
  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 8);
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = `Total (${formatNumber(cameras.length)} produk)`;

  const sumCell = (col, letter, result, numFmt) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${firstRow}:${letter}${lastRow})`,
      result,
    };
    cell.numFmt = numFmt;
  };

  sumCell(9, "I", sums.stock, XLSX_NUMBER);
  sumCell(13, "M", sums.costValue, XLSX_RUPIAH);
  sumCell(14, "N", sums.sellValue, XLSX_RUPIAH);
  styleTotalRow(totalRow, lastColumn);

  const notes = [
    "Catatan:",
    "• Nilai stok = stok × modal (atau × harga jual). Laba per unit = harga jual − modal.",
    `• Stok berwarna merah berarti habis, oranye berarti menipis (maksimal ${LOW_STOCK_LIMIT} unit).`,
    "• Ringkasan per kategori ada di sheet “Ringkasan Kategori”.",
  ];
  const warningIndexes = [];
  if (missingCapital > 0) {
    notes.push(
      `• ${formatNumber(missingCapital)} produk belum punya modal, jadi laba per unit dan nilai stok (modal) kosong dan tidak masuk total.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  if (truncated) {
    notes.push(
      `• Hanya ${formatNumber(cameras.length)} dari ${formatNumber(totalAll)} produk yang berhasil diekspor.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(sheet, totalRowNumber + 2, lastColumn, notes, warningIndexes);

  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: lastRow, column: lastColumn },
  };

  /* ================= Sheet 2: Ringkasan Kategori ================= */

  const summaryHeaderRow = 4;
  const summaryLastColumn = CATEGORY_HEADERS.length;
  const summarySheet = createSheet(
    workbook,
    "Ringkasan Kategori",
    "Ringkasan Kategori",
    CATEGORY_HEADERS,
    summaryHeaderRow,
  );

  writeTitle(
    summarySheet,
    summaryLastColumn,
    "RINGKASAN PER KATEGORI",
    `${formatNumber(cameras.length)} produk dalam ${formatNumber(categories.length)} kategori`,
  );

  writeHeaderRow(summarySheet, summaryHeaderRow, CATEGORY_HEADERS);

  const firstSummaryRow = summaryHeaderRow + 1;

  categories.forEach((category, index) => {
    const row = summarySheet.getRow(firstSummaryRow + index);
    row.values = [
      index + 1,
      category.name,
      category.products,
      category.stock,
      category.soldOut,
      category.costValue,
      category.sellValue,
    ];

    styleDataRow(row, CATEGORY_HEADERS, index);

    row.getCell(2).font = { bold: true, color: { argb: XLSX_COLORS.title } };
    [3, 4, 5].forEach((col) => (row.getCell(col).numFmt = XLSX_NUMBER));
    [6, 7].forEach((col) => (row.getCell(col).numFmt = XLSX_RUPIAH));
    if (category.soldOut > 0) {
      row.getCell(5).font = { bold: true, color: { argb: XLSX_COLORS.danger } };
    }
  });

  const lastSummaryRow = firstSummaryRow + categories.length - 1;
  const summaryTotalRowNumber = lastSummaryRow + 1;
  summarySheet.mergeCells(summaryTotalRowNumber, 1, summaryTotalRowNumber, 2);
  const summaryTotalRow = summarySheet.getRow(summaryTotalRowNumber);
  summaryTotalRow.getCell(1).value = "Total";

  const summaryTotals = [
    [3, "C", cameras.length, XLSX_NUMBER],
    [4, "D", sums.stock, XLSX_NUMBER],
    [5, "E", soldOutCount, XLSX_NUMBER],
    [6, "F", sums.costValue, XLSX_RUPIAH],
    [7, "G", sums.sellValue, XLSX_RUPIAH],
  ];

  summaryTotals.forEach(([col, letter, result, numFmt]) => {
    const cell = summaryTotalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${firstSummaryRow}:${letter}${lastSummaryRow})`,
      result,
    };
    cell.numFmt = numFmt;
  });
  styleTotalRow(summaryTotalRow, summaryLastColumn);

  summarySheet.autoFilter = {
    from: { row: summaryHeaderRow, column: 1 },
    to: { row: lastSummaryRow, column: summaryLastColumn },
  };

  await downloadWorkbook(workbook, `daftar-produk_${wibToday()}.xlsx`);
}

/* -------------------------------- Component ------------------------------ */

export default function ExportCamerasButton({ disabled = false }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    try {
      await exportCamerasExcel();
      notify.success("File daftar produk berhasil diunduh.");
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
