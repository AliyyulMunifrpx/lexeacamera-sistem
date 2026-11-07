"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { useSearchParams } from "next/navigation.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBox,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiDownload,
  FiFileText,
  FiLoader,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";

import { getReportTransactions } from "../../../../features/reports/api.js";
import { useGetCategories } from "../../../../features/categories/hooks.js";
import { useGetReportTransactions } from "../../../../features/reports/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/* -------------------------------------------------------------------------- */

const BACK_PATH = "/owner/reports";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

const PER_PAGE = 20;
const EXPORT_LIMIT = 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidParam(value) {
  return value && UUID_RE.test(value) ? value : "";
}

const TYPE_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "SALE", label: "Penjualan" },
  { value: "REFUND", label: "Refund" },
];

/* -------------------------------- Date utils ------------------------------ */

function wibToday() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(value, amount) {
  return formatDay(parseDay(value) + amount * 86400000);
}

function startOfMonth(value, monthOffset = 0) {
  const date = new Date(parseDay(value));
  return formatDay(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1),
  );
}

function daysBetween(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000) + 1;
}

const PRESETS = [
  {
    key: "7d",
    label: "7 hari",
    range: (t) => ({ from: addDays(t, -6), to: t }),
  },
  {
    key: "30d",
    label: "30 hari",
    range: (t) => ({ from: addDays(t, -29), to: t }),
  },
  {
    key: "month",
    label: "Bulan ini",
    range: (t) => ({ from: startOfMonth(t), to: t }),
  },
  {
    key: "last-month",
    label: "Bulan lalu",
    range: (t) => ({
      from: startOfMonth(t, -1),
      to: addDays(startOfMonth(t), -1),
    }),
  },
  {
    key: "12m",
    label: "12 bulan",
    range: (t) => ({ from: startOfMonth(t, -11), to: t }),
  },
];

function formatPeriod(from, to) {
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };
  const f = new Date(parseDay(from)).toLocaleDateString("id-ID", options);
  const t = new Date(parseDay(to)).toLocaleDateString("id-ID", options);
  return `${f} – ${t}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/* -------------------------------- Number utils ---------------------------- */

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function formatRupiah(value = 0) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(rounded))}`;
}

/* ------------------------------ Error Mapping ----------------------------- */

function explainError(error) {
  const status = error?.response?.status;

  if (status === 404) {
    return {
      title: "Data transaksi belum tersedia",
      description:
        "Server tidak menemukan data untuk permintaan ini. Coba ubah rentang tanggal, filter, atau kata kunci.",
    };
  }
  if (status === 401) {
    return {
      title: "Sesi Anda telah berakhir",
      description: "Silakan login ulang.",
    };
  }
  if (status === 403) {
    return {
      title: "Anda tidak punya akses",
      description: "Akun Anda tidak punya izin untuk membuka laporan ini.",
    };
  }
  if (status >= 500) {
    return {
      title: "Server sedang bermasalah",
      description: "Coba lagi beberapa saat.",
    };
  }
  if (error?.code === "ERR_NETWORK" || status === undefined) {
    return {
      title: "Koneksi ke server gagal",
      description: "Periksa koneksi internet Anda, lalu coba lagi.",
    };
  }
  return {
    title: "Gagal memuat transaksi",
    description:
      normalizeApiError(error).message || "Terjadi kesalahan tak terduga.",
  };
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    muted: "border border-second/30 text-second/65",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MiniStatCard({ icon: Icon, label, value, hint, tone = "neutral" }) {
  const iconTones = {
    neutral: "bg-grad text-primary shadow-lg shadow-second4/25",
    success: "bg-second3 text-primary shadow-lg shadow-second3/25",
    failure: "bg-second2 text-primary shadow-lg shadow-second2/25",
    pending: "bg-second4 text-primary shadow-lg shadow-second4/25",
  };

  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-second/60">{label}</p>
        <p className="mt-1 break-words text-lg font-bold tabular-nums text-second">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-xs tabular-nums text-second/60">
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`${BTN_BASE} ${
              active
                ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                : "border border-second/30 text-second hover:border-second4 hover:text-second4"
            } ${FOCUS_RING}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="h-40 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ error, onRetry, isFetching }) {
  const info = explainError(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center"
    >
      <FiAlertTriangle size={32} className="text-second2" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-second">{info.title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-second/60">
        {info.description}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        <FiRefreshCw
          size={16}
          className={
            isFetching ? "animate-spin motion-reduce:animate-none" : ""
          }
          aria-hidden="true"
        />
        {isFetching ? "Memuat…" : "Coba lagi"}
      </button>
    </div>
  );
}

/* ------------------------- Expandable items row --------------------------- */

function TransactionItems({ items }) {
  if (!items || items.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-second/60">
        Tidak ada rincian item untuk transaksi ini.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl ">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-grad text-primary">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Produk
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Harga
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Modal
            </th>
            <th scope="col" className="px-3 py-2 text-center font-semibold">
              Stok
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-second/10">
          {items.map((item, index) => (
            <tr
              key={`${item.camera_id}-${index}`}
              className={`align-top transition-colors hover:bg-second/20 ${index % 2 === 0 ? "" : "bg-second3/20"}`}
            >
              <td className="px-3 py-2 text-second">{item.name ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second">
                {formatNumber(item.quantity)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second">
                {formatRupiah(item.price)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second">
                {formatRupiah(item.modal)}
              </td>
              <td className="px-3 py-2 text-center">
                {item.restocked === true && <Tag tone="success">Kembali</Tag>}
                {item.restocked === false && (
                  <Tag tone="muted">Tidak kembali</Tag>
                )}
                {item.restocked === null && (
                  <span className="text-second/50">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- Export Excel ----------------------------- */

const XLSX_COLORS = {
  brand: "FF4F46E5",
  brandText: "FFFFFFFF",
  title: "FF1E1B4B",
  muted: "FF6B7280",
  zebra: "FFF5F5FB",
  border: "FFD9D9E3",
  total: "FFE8E8F5",
  profit: "FF047857",
  refund: "FFB91C1C",
  warning: "FFB45309",
};

const XLSX_RUPIAH = '"Rp" #,##0;[Red]-"Rp" #,##0';
const XLSX_NUMBER = "#,##0;[Red]-#,##0";
const XLSX_DATETIME = "dd mmm yyyy hh:mm";

const TX_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Invoice", width: 22, align: "left" },
  { label: "Tanggal lunas (WIB)", width: 22, align: "center" },
  { label: "Customer", width: 28, align: "left" },
  { label: "ID customer", width: 16, align: "left" },
  { label: "Tipe", width: 12, align: "center" },
  { label: "Unit", width: 10, align: "right" },
  { label: "Omzet", width: 20, align: "right" },
  { label: "Modal", width: 20, align: "right" },
  { label: "Laba", width: 20, align: "right" },
];

const ITEM_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Invoice", width: 22, align: "left" },
  { label: "Tanggal lunas (WIB)", width: 22, align: "center" },
  { label: "Tipe", width: 12, align: "center" },
  { label: "Customer", width: 28, align: "left" },
  { label: "Produk", width: 40, align: "left" },
  { label: "Qty", width: 8, align: "right" },
  { label: "Harga satuan", width: 18, align: "right" },
  { label: "Modal satuan", width: 18, align: "right" },
  { label: "Status stok", width: 16, align: "center" },
];

const THIN_BORDER = {
  top: { style: "thin", color: { argb: XLSX_COLORS.border } },
  left: { style: "thin", color: { argb: XLSX_COLORS.border } },
  bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
  right: { style: "thin", color: { argb: XLSX_COLORS.border } },
};

function solidFill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
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

function typeText(type) {
  return type === "REFUND" ? "Refund" : "Penjualan";
}

function stockText(restocked) {
  if (restocked === true) return "Kembali ke stok";
  if (restocked === false) return "Tidak kembali";
  return "-";
}

function createSheet(workbook, name, footerLabel, headers, headerRowNumber) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
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

function writeNotes(sheet, startRow, lastColumn, notes, warningIndexes = []) {
  notes.forEach((text, index) => {
    const rowNumber = startRow + index;
    sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = text;
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

async function exportTransactionsExcel({
  from,
  to,
  type,
  search,
  product,
  category_id,
  camera_id,
  filterInfo,
}) {
  const response = await getReportTransactions({
    from,
    to,
    type,
    search,
    product,
    category_id,
    camera_id,
    limit: EXPORT_LIMIT,
    page: 1,
  });

  const rows = response.data ?? [];
  if (rows.length === 0) {
    throw new Error("Tidak ada transaksi untuk diekspor.");
  }

  const totalAll = response.paging?.total ?? rows.length;
  const truncated = totalAll > rows.length;
  const itemFilterActive = Boolean(product || category_id || camera_id);

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rincian Transaksi";
  workbook.created = new Date();

  const periodText = `${formatPeriod(from, to)} (${daysBetween(from, to)} hari)`;
  const saleCount = rows.filter((tx) => tx.type !== "REFUND").length;
  const refundCount = rows.length - saleCount;

  /* ===================== Sheet 1: Transaksi ===================== */

  const meta = [
    ["Periode", periodText],
    ["Diekspor pada", formatExportTimestamp()],
    ["Tipe transaksi", filterInfo.typeLabel],
    ["Cari transaksi", search || "Semua transaksi"],
    ["Filter produk", filterInfo.productLabel],
    ["Kategori", filterInfo.categoryLabel],
    [
      "Cakupan data",
      truncated
        ? `${formatNumber(rows.length)} transaksi terbaru dari ${formatNumber(totalAll)} (${formatNumber(saleCount)} penjualan, ${formatNumber(refundCount)} refund)`
        : `${formatNumber(rows.length)} transaksi (${formatNumber(saleCount)} penjualan, ${formatNumber(refundCount)} refund)`,
    ],
  ];

  const txHeaderRow = 4 + meta.length + 1;
  const txLastColumn = TX_HEADERS.length;
  const txSheet = createSheet(
    workbook,
    "Transaksi",
    "Rincian Transaksi",
    TX_HEADERS,
    txHeaderRow,
  );

  writeTitle(
    txSheet,
    txLastColumn,
    "RINCIAN TRANSAKSI",
    "Semua order lunas (penjualan dan refund) di periode ini. Refund bernilai negatif, sehingga total langsung net.",
  );

  meta.forEach(([label, value], index) => {
    const rowNumber = 4 + index;
    txSheet.mergeCells(rowNumber, 1, rowNumber, 2);
    txSheet.mergeCells(rowNumber, 3, rowNumber, txLastColumn);

    const labelCell = txSheet.getCell(rowNumber, 1);
    labelCell.value = label;
    labelCell.font = {
      bold: true,
      size: 10,
      color: { argb: XLSX_COLORS.title },
    };
    labelCell.alignment = { vertical: "middle", horizontal: "left" };

    const valueCell = txSheet.getCell(rowNumber, 3);
    valueCell.value = value;
    valueCell.font = { size: 10 };
    valueCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });

  writeHeaderRow(txSheet, txHeaderRow, TX_HEADERS);

  const firstTxRow = txHeaderRow + 1;
  const sums = { units: 0, revenue: 0, cost: 0, profit: 0 };

  rows.forEach((tx, index) => {
    const isRefund = tx.type === "REFUND";
    // Unit dibuat negatif untuk refund supaya konsisten dengan omzet, modal, dan laba.
    const units = (isRefund ? -1 : 1) * (tx.units ?? 0);
    const revenue = tx.revenue ?? 0;
    const cost = tx.cost ?? 0;
    const profit = tx.profit ?? 0;

    sums.units += units;
    sums.revenue += revenue;
    sums.cost += cost;
    sums.profit += profit;

    const row = txSheet.getRow(firstTxRow + index);
    row.values = [
      index + 1,
      tx.invoice_no ?? "-",
      toWibCellDate(tx.paid_at),
      tx.customer_name ?? "-",
      tx.customer_id ?? "-",
      typeText(tx.type),
      units,
      revenue,
      cost,
      profit,
    ];

    styleDataRow(row, TX_HEADERS, index, [4]);

    row.getCell(3).numFmt = XLSX_DATETIME;
    row.getCell(7).numFmt = XLSX_NUMBER;
    [8, 9, 10].forEach((col) => (row.getCell(col).numFmt = XLSX_RUPIAH));
    row.getCell(6).font = {
      bold: true,
      color: { argb: isRefund ? XLSX_COLORS.refund : XLSX_COLORS.title },
    };
    row.getCell(10).font = {
      bold: true,
      color: { argb: profit < 0 ? XLSX_COLORS.refund : XLSX_COLORS.profit },
    };
  });

  const lastTxRow = firstTxRow + rows.length - 1;
  const totalRowNumber = lastTxRow + 1;
  const totalRow = txSheet.getRow(totalRowNumber);
  totalRow.height = 24;
  txSheet.mergeCells(totalRowNumber, 1, totalRowNumber, 6);
  totalRow.getCell(1).value = "Total (net setelah refund)";

  const sumCell = (col, letter, result, numFmt) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${firstTxRow}:${letter}${lastTxRow})`,
      result,
    };
    cell.numFmt = numFmt;
  };

  sumCell(7, "G", sums.units, XLSX_NUMBER);
  sumCell(8, "H", sums.revenue, XLSX_RUPIAH);
  sumCell(9, "I", sums.cost, XLSX_RUPIAH);
  sumCell(10, "J", sums.profit, XLSX_RUPIAH);

  for (let col = 1; col <= txLastColumn; col += 1) {
    const cell = totalRow.getCell(col);
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

  const txNotes = [
    "Catatan:",
    "• Hanya order berstatus lunas yang dihitung. Unit, omzet, modal, dan laba pada refund bernilai negatif.",
    "• Modal = modal barang terjual. Pada refund, hanya modal barang yang kembali ke stok yang dikurangkan.",
    "• Rincian produk per transaksi ada di sheet “Rincian Item”.",
  ];
  const warningIndexes = [];
  if (itemFilterActive) {
    txNotes.push(
      "• Filter produk atau kategori aktif: unit, omzet, modal, dan laba hanya dihitung dari produk yang cocok, bukan seluruh isi order.",
    );
  }
  if (truncated) {
    txNotes.push(
      `• Hanya ${formatNumber(rows.length)} transaksi terbaru dari ${formatNumber(totalAll)} yang diekspor. Persempit rentang tanggal atau filter untuk mendapat data lengkap.`,
    );
    warningIndexes.push(txNotes.length - 1);
  }
  writeNotes(
    txSheet,
    totalRowNumber + 2,
    txLastColumn,
    txNotes,
    warningIndexes,
  );

  txSheet.autoFilter = {
    from: { row: txHeaderRow, column: 1 },
    to: { row: lastTxRow, column: txLastColumn },
  };

  /* ==================== Sheet 2: Rincian Item ==================== */

  const itemLines = [];
  rows.forEach((tx) => {
    (tx.items ?? []).forEach((item) => {
      itemLines.push({ tx, item });
    });
  });

  const itemHeaderRow = 4;
  const itemLastColumn = ITEM_HEADERS.length;
  const itemSheet = createSheet(
    workbook,
    "Rincian Item",
    "Rincian Item Transaksi",
    ITEM_HEADERS,
    itemHeaderRow,
  );
  itemSheet.views = [
    { state: "frozen", ySplit: itemHeaderRow, showGridLines: false },
  ];

  writeTitle(
    itemSheet,
    itemLastColumn,
    "RINCIAN ITEM TRANSAKSI",
    `${periodText} • ${formatNumber(itemLines.length)} item dari ${formatNumber(rows.length)} transaksi`,
  );

  writeHeaderRow(itemSheet, itemHeaderRow, ITEM_HEADERS);

  itemLines.forEach(({ tx, item }, index) => {
    const row = itemSheet.getRow(itemHeaderRow + 1 + index);
    row.values = [
      index + 1,
      tx.invoice_no ?? "-",
      toWibCellDate(tx.paid_at),
      typeText(tx.type),
      tx.customer_name ?? "-",
      item.name ?? "-",
      item.quantity ?? 0,
      item.price ?? 0,
      item.modal ?? 0,
      tx.type === "REFUND" ? stockText(item.restocked) : "-",
    ];

    styleDataRow(row, ITEM_HEADERS, index, [5, 6]);

    row.getCell(3).numFmt = XLSX_DATETIME;
    row.getCell(7).numFmt = XLSX_NUMBER;
    [8, 9].forEach((col) => (row.getCell(col).numFmt = XLSX_RUPIAH));
    if (tx.type === "REFUND") {
      row.getCell(4).font = { bold: true, color: { argb: XLSX_COLORS.refund } };
    }
  });

  const lastItemRow = itemHeaderRow + itemLines.length;
  if (itemLines.length > 0) {
    itemSheet.autoFilter = {
      from: { row: itemHeaderRow, column: 1 },
      to: { row: lastItemRow, column: itemLastColumn },
    };
  }

  writeNotes(
    itemSheet,
    lastItemRow + 2,
    itemLastColumn,
    [
      "Catatan:",
      "• Harga dan modal adalah nilai per unit saat order dibuat. Harga item belum memperhitungkan diskon order, sehingga omzet transaksi bisa berbeda dari total harga item.",
      "• Status stok hanya berlaku untuk refund: Kembali ke stok atau Tidak kembali.",
      ...(itemFilterActive
        ? [
            "• Hanya item yang cocok dengan filter produk atau kategori yang ditampilkan.",
          ]
        : []),
    ],
    [],
  );

  await downloadWorkbook(workbook, `rincian-transaksi_${from}_sd_${to}.xlsx`);
}

/* ---------------------------------- Page --------------------------------- */

function TransactionsReport() {
  const [today] = useState(wibToday);
  const searchParams = useSearchParams();
  const paramProductId = uuidParam(searchParams.get("product_id"));
  const paramCategoryId = uuidParam(searchParams.get("category_id"));

  const [presetKey, setPresetKey] = useState("30d");
  const [range, setRange] = useState(() => PRESETS[1].range(wibToday()));
  const [draft, setDraft] = useState(range);
  const [type, setType] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [productInput, setProductInput] = useState("");
  const [product, setProduct] = useState("");
  const [categoryId, setCategoryId] = useState(paramCategoryId);
  const [productId, setProductId] = useState(paramProductId);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const invalidRange =
    draft.from !== "" && draft.to !== "" && draft.from > draft.to;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProduct(productInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [productInput]);

  // Filter dari link (product_id / category_id) diutamakan. Setelah itu
  // kategori bisa diganti lewat dropdown.
  useEffect(() => {
    setProductId(paramProductId);
    setCategoryId(paramCategoryId);
    setCurrentPage(1);
  }, [paramProductId, paramCategoryId]);

  const categoriesQuery = useGetCategories();
  const categories = useMemo(() => {
    const raw = categoriesQuery.data;
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
          ? raw.data.data
          : [];
    return list.filter((item) => item?.id && item?.name);
  }, [categoriesQuery.data]);
  const categoryKnown = categories.some((item) => item.id === categoryId);

  const query = useGetReportTransactions({
    ...range,
    type,
    search,
    product,
    category_id: categoryId,
    camera_id: productId,
    limit: PER_PAGE,
    page: currentPage,
  });

  const transactions = query.data?.data ?? [];
  const paging = query.data?.paging;
  const totals = query.data?.totals;

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? PER_PAGE;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const itemFilterActive =
    product !== "" || categoryId !== "" || productId !== "";
  const pickedProductName = transactions[0]?.items?.[0]?.name;
  const hasFilters =
    search !== "" || itemFilterActive || type !== "" || presetKey !== "30d";

  function applyPreset(preset) {
    const next = preset.range(today);
    setPresetKey(preset.key);
    setRange(next);
    setDraft(next);
    setCurrentPage(1);
  }

  function updateDraft(key, value) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setPresetKey("custom");
    if (next.from && next.to && next.from <= next.to) {
      setRange(next);
      setCurrentPage(1);
    }
  }

  function resetFilters() {
    setPresetKey("30d");
    const next = PRESETS[1].range(today);
    setRange(next);
    setDraft(next);
    setType("");
    setSearchInput("");
    setSearch("");
    setProductInput("");
    setProduct("");
    setProductId("");
    setCategoryId("");
    setCurrentPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const productParts = [
        product && `Nama mengandung “${product}”`,
        productId &&
          (pickedProductName ?? "Produk dipilih dari laporan produk"),
      ].filter(Boolean);

      await exportTransactionsExcel({
        ...range,
        type,
        search,
        product,
        category_id: categoryId,
        camera_id: productId,
        filterInfo: {
          typeLabel:
            type === ""
              ? "Semua tipe"
              : (TYPE_OPTIONS.find((option) => option.value === type)?.label ??
                type),
          productLabel:
            productParts.length > 0 ? productParts.join("; ") : "Semua produk",
          categoryLabel: categoryId
            ? (categories.find((item) => item.id === categoryId)?.name ??
              "Kategori dari link")
            : "Semua kategori",
        },
      });
      notify.success("File Excel berhasil diunduh.");
    } catch (err) {
      notify.error(
        normalizeApiError(err).message || "Gagal membuat file Excel.",
      );
    } finally {
      setExporting(false);
    }
  }

  function toggleExpand(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  if (query.isPending) {
    return <LoadingState />;
  }

  if (query.isError && !query.data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={BACK_PATH}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke laporan
          </Link>
        </header>
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          href={BACK_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke laporan
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
              <FiFileText size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Rincian <span className="text-grad">Transaksi</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Semua order lunas (penjualan dan refund) di periode. Refund
                bernilai negatif sehingga total langsung net.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Perbarui data"
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  query.isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }
                aria-hidden="true"
              />
              {query.isFetching ? "Memperbarui…" : "Perbarui"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={transactions.length === 0 || exporting}
              aria-busy={exporting}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
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
          </div>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter transaksi"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Pilih rentang tanggal, filter tipe, kategori, atau cari transaksi
            dan produk.
          </p>
        </div>

        <Segmented
          label="Periode cepat"
          value={presetKey}
          onChange={(key) => applyPreset(PRESETS.find((p) => p.key === key))}
          options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="report-from" className={labelClass}>
              Dari tanggal
            </label>
            <input
              id="report-from"
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(event) => updateDraft("from", event.target.value)}
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="report-to" className={labelClass}>
              Sampai tanggal
            </label>
            <input
              id="report-to"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(event) => updateDraft("to", event.target.value)}
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </div>
        </div>

        {invalidRange ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-xs text-second2"
          >
            <FiAlertTriangle
              size={14}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Tanggal awal tidak boleh lebih besar dari tanggal akhir.
          </p>
        ) : (
          <p className="text-xs tabular-nums text-second/60">
            Menampilkan {formatPeriod(range.from, range.to)} (
            {daysBetween(range.from, range.to)} hari).
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="report-product" className={labelClass}>
              Cari produk
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="report-product"
                type="search"
                value={productInput}
                onChange={(event) => setProductInput(event.target.value)}
                placeholder="Cari nama produk…"
                className={`${inputClass(false)} pl-8`}
                maxLength={100}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="report-category" className={labelClass}>
              Kategori
            </label>
            <select
              id="report-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setCurrentPage(1);
              }}
              disabled={categoriesQuery.isPending}
              className={inputClass(false)}
            >
              <option value="">
                {categoriesQuery.isPending
                  ? "Memuat kategori…"
                  : "Semua kategori"}
              </option>
              {categoryId !== "" &&
                !categoryKnown &&
                !categoriesQuery.isPending && (
                  <option value={categoryId}>Kategori dari link</option>
                )}
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {productId !== "" && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">Produk dipilih</Tag>
            <span className="min-w-0 break-words text-sm text-second">
              {pickedProductName ?? "Dari laporan produk"}
            </span>
            <button
              type="button"
              onClick={() => {
                setProductId("");
                setCurrentPage(1);
              }}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={16} aria-hidden="true" />
              Hapus filter produk
            </button>
          </div>
        )}

        {itemFilterActive && (
          <p className="text-xs text-second/60">
            Unit, omzet, modal, dan laba hanya dihitung dari produk yang cocok
            dengan pencarian, bukan seluruh isi order.
          </p>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="report-search" className={labelClass}>
              Cari transaksi
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="report-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari nomor invoice, nama, atau ID customer…"
                className={`${inputClass(false)} pl-8`}
                maxLength={100}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>Tipe</p>
            <Segmented
              label="Filter tipe transaksi"
              value={type}
              onChange={(value) => {
                setType(value);
                setCurrentPage(1);
              }}
              options={TYPE_OPTIONS}
            />
          </div>
        </div>
      </section>

      {/* Ringkasan total — pakai MiniStatCard dengan icon */}
      {totals && (
        <section
          aria-label="Total transaksi"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MiniStatCard
            icon={FiFileText}
            label="Total order"
            tone="neutral"
            value={formatNumber(totals.orders)}
            hint={`${formatNumber(totals.sales_orders ?? 0)} penjualan · ${formatNumber(totals.refund_orders ?? 0)} refund`}
          />
          <MiniStatCard
            icon={FiTrendingUp}
            label="Omzet"
            tone="neutral"
            value={formatRupiah(totals.revenue)}
            hint="Net setelah refund"
          />
          <MiniStatCard
            icon={FiBox}
            label="Modal"
            tone="pending"
            value={formatRupiah(totals.cost)}
            hint="Modal barang terjual"
          />
          <MiniStatCard
            icon={FiShoppingBag}
            label="Laba"
            tone="success"
            value={formatRupiah(totals.profit)}
            hint="Net setelah refund"
          />
        </section>
      )}

      {/* Judul daftar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar transaksi</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} transaksi
          </p>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">Filter aktif</Tag>
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Daftar transaksi */}
      <div className="relative min-h-40">
        {query.isFetching && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin motion-reduce:animate-none text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        {transactions.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${query.isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="w-8 px-2 py-3" />
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Invoice
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Tanggal lunas
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Tipe
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Unit
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Omzet
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Laba
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-second/10">
                  {transactions.map((tx, i) => {
                    const isRefund = tx.type === "REFUND";
                    const isOpen = expandedId === tx.id;
                    return (
                      <Fragment key={tx.id}>
                        <tr
                          className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                        >
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(tx.id)}
                              aria-label={
                                isOpen
                                  ? "Tutup rincian item"
                                  : "Buka rincian item"
                              }
                              aria-expanded={isOpen}
                              className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
                            >
                              {isOpen ? (
                                <FiChevronUp size={16} aria-hidden="true" />
                              ) : (
                                <FiChevronDown size={16} aria-hidden="true" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-second">
                            {tx.invoice_no ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-second/80">
                            {tx.customer_name ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-second/60">
                            {formatDateTime(tx.paid_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Tag tone={isRefund ? "failure" : "blue"}>
                              {isRefund ? "Refund" : "Penjualan"}
                            </Tag>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second">
                            {formatNumber(tx.units)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second">
                            {formatRupiah(tx.revenue)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums">
                            <span
                              className={
                                tx.profit < 0 ? "text-second2" : "text-second3"
                              }
                            >
                              {formatRupiah(tx.profit)}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-second/[0.02]">
                            <td />
                            <td colSpan={7} className="px-4 py-3">
                              <TransactionItems items={tx.items} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t border-second/30 bg-second/[0.03]">
                      <td
                        colSpan={5}
                        className="px-4 py-3 text-right text-xs font-semibold text-second/60"
                      >
                        Total ({formatNumber(totals.orders)} order)
                      </td>
                      <td />
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-second">
                        {formatRupiah(totals.revenue)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-second">
                        {formatRupiah(totals.profit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {transactions.map((tx) => {
                const isRefund = tx.type === "REFUND";
                const isOpen = expandedId === tx.id;
                return (
                  <li key={tx.id}>
                    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs font-semibold text-second">
                            {tx.invoice_no ?? "—"}
                          </p>
                          <p className="mt-2 break-words text-sm font-semibold text-second">
                            {tx.customer_name ?? "—"}
                          </p>
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {formatDateTime(tx.paid_at)}
                          </p>
                        </div>
                        <Tag tone={isRefund ? "failure" : "blue"}>
                          {isRefund ? "Refund" : "Penjualan"}
                        </Tag>
                      </div>

                      <dl className="grid grid-cols-3 gap-4 border-t border-second/30 pt-4 text-sm">
                        <div>
                          <dt className="text-xs text-second/60">Unit</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second">
                            {formatNumber(tx.units)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-second/60">Omzet</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second">
                            {formatRupiah(tx.revenue)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-second/60">Laba</dt>
                          <dd
                            className={`mt-2 font-semibold tabular-nums ${tx.profit < 0 ? "text-second2" : "text-second3"}`}
                          >
                            {formatRupiah(tx.profit)}
                          </dd>
                        </div>
                      </dl>

                      <button
                        type="button"
                        onClick={() => toggleExpand(tx.id)}
                        aria-expanded={isOpen}
                        className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                      >
                        {isOpen ? (
                          <>
                            <FiChevronUp size={16} aria-hidden="true" />
                            Sembunyikan item
                          </>
                        ) : (
                          <>
                            <FiChevronDown size={16} aria-hidden="true" />
                            Lihat item
                          </>
                        )}
                      </button>

                      {isOpen && <TransactionItems items={tx.items} />}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiFileText size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada transaksi yang cocok dengan filter atau pencarian."
                : "Transaksi lunas akan muncul di sini setelah ada order."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Paginasi */}
      {total > 0 && (
        <nav
          aria-label="Paginasi transaksi"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || query.isFetching}
              onClick={() => {
                setCurrentPage((page) => Math.max(1, page - 1));
                setExpandedId(null);
              }}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || query.isFetching}
              onClick={() => {
                setCurrentPage((page) => Math.min(totalPages, page + 1));
                setExpandedId(null);
              }}
              className={`${BTN_BASE} flex-1 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default function TransactionsReportPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TransactionsReport />
    </Suspense>
  );
}
