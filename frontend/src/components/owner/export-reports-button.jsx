"use client";

import { useState } from "react";
import { FiFileText, FiLoader } from "react-icons/fi";

import {
  BTN_BASE,
  FOCUS_RING,
  describeError,
  formatDate,
  formatDateTime,
  getRemitStatus,
  hasRemitAmounts,
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

const MARGIN = 10; // mm
const BAND_HEIGHT = 25; // mm, band judul di atas halaman pertama
const FOOTER_SPACE = 14; // mm, ruang kosong di bawah supaya tidak menimpa footer

/* Palet sama dengan invoice PDF: marun tua #3a0718 dan marun #6c1b30. RGB. */
const COLORS = {
  dark: [58, 7, 24],
  accent: [108, 27, 48],
  onDark: [240, 218, 225],
  white: [255, 255, 255],
  title: [58, 7, 24],
  text: [30, 30, 30],
  muted: [102, 102, 102],
  zebra: [250, 245, 247],
  tint: [250, 241, 244],
  border: [217, 217, 217],
  income: [21, 128, 61],
  danger: [185, 28, 28],
  warning: [180, 83, 9],
};
// Warna teks status di tabel PDF.
const STATUS_STYLES = {
  approved: { textColor: COLORS.income, fontStyle: "bold" },
  paid: { textColor: COLORS.warning, fontStyle: "bold" },
  unpaid: { textColor: COLORS.muted },
};
/*
 * Tabel ringkasan (landscape A4, lebar pakai 277 mm). Kolom angka tanpa "Rp"
 * supaya muat; satuan rupiah dijelaskan di subjudul.
 * Urutan kolom (0..18):
 *  0 No | 1 Tanggal | 2-3 Saldo awal (tunai, non tunai) | 4-5 Masuk | 6-7 Keluar
 *  8-10 Saldo akhir (tunai, non tunai, total) | 11-12 Setoran (tunai, transfer)
 *  13-15 Saldo setelah disetor (tunai, non tunai, total) | 16 Baris
 *  17 Status | 18 Bukti
 */
const MONEY_WIDTH = 14.3;
const SUMMARY_WIDTHS = [7, 17, ...Array(14).fill(MONEY_WIDTH), 10, 30, 14];
const SUMMARY_CENTER_COLUMNS = [0, 1, 17, 18];

const SUMMARY_COLUMN_STYLES = Object.fromEntries(
  SUMMARY_WIDTHS.map((width, index) => [
    index,
    {
      cellWidth: width,
      halign: SUMMARY_CENTER_COLUMNS.includes(index) ? "center" : "right",
    },
  ]),
);

const tall = (label) => ({ content: label, rowSpan: 2 });
const group = (label, span) => ({
  content: label,
  colSpan: span,
  styles: { fillColor: COLORS.dark },
});
const sub = (label) => ({
  content: label,
  styles: { fillColor: COLORS.accent },
});

const SUMMARY_HEAD = [
  [
    tall("No"),
    tall("Tanggal"),
    group("Saldo awal", 2),
    group("Masuk", 2),
    group("Keluar", 2),
    group("Saldo akhir", 3),
    group("Setoran", 2),
    group("Saldo setelah disetor", 3),
    tall("Baris"),
    tall("Status setoran"),
    tall("Bukti"),
  ],
  [
    sub("Tunai"),
    sub("Non tunai"),
    sub("Tunai"),
    sub("Non tunai"),
    sub("Tunai"),
    sub("Non tunai"),
    sub("Tunai"),
    sub("Non tunai"),
    sub("Total"),
    sub("Tunai"),
    sub("Transfer"),
    sub("Tunai"),
    sub("Non tunai"),
    sub("Total"),
  ],
];

/* Rincian kas gabungan (landscape, lebar 281 mm). */
const ENTRY_HEAD = [
  [
    "No",
    "Tanggal",
    "Metode",
    "Atas nama",
    "Keterangan",
    "Masuk",
    "Keluar",
    "Saldo (tunai + non tunai)",
  ],
];
const ENTRY_COLUMN_STYLES = {
  0: { cellWidth: 10, halign: "center" },
  1: { cellWidth: 20, halign: "center" },
  2: { cellWidth: 20, halign: "center" },
  3: { cellWidth: 55, halign: "left" },
  4: { cellWidth: 85, halign: "left" },
  5: { cellWidth: 30, halign: "right" },
  6: { cellWidth: 30, halign: "right" },
  7: { cellWidth: 31, halign: "right" },
};

/* Detail satu laporan (portrait, lebar 190 mm). */
const DETAIL_HEAD = [
  ["No", "Metode", "Atas nama", "Keterangan", "Masuk", "Keluar", "Saldo"],
];
const DETAIL_COLUMN_STYLES = {
  0: { cellWidth: 8, halign: "center" },
  1: { cellWidth: 18, halign: "center" },
  2: { cellWidth: 36, halign: "left" },
  3: { cellWidth: 46, halign: "left" },
  4: { cellWidth: 27, halign: "right" },
  5: { cellWidth: 27, halign: "right" },
  6: { cellWidth: 28, halign: "right" },
};

/* -------------------------------- Helpers --------------------------------- */

/*
 * Font bawaan jsPDF (Helvetica) hanya mendukung Latin-1. Karakter di luar itu
 * (emoji, tanda kutip melengkung, dll.) dinormalkan atau diganti "?" supaya
 * tidak muncul sebagai teks rusak.
 */
function pdfText(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");
}

function text(value) {
  const result = typeof value === "string" ? value.trim() : value;
  return result === null || result === undefined || result === ""
    ? "-"
    : pdfText(result);
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function rupiah(value = 0) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}Rp ${formatNumber(Math.abs(rounded))}`;
}

// Nol tampil sebagai "-".
function rupiahDash(value = 0) {
  return Math.round(value) === 0 ? "-" : rupiah(value);
}

const num = (value) => Number(value) || 0;

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

  if (filters.remitted === "true") parts.push("Approve owner");
  if (filters.remitted === "false") parts.push("Belum approve");
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
  const filled = hasRemitAmounts(report);
  const remitCash = filled ? num(report.remit_cash) : 0;
  const remitTransfer = filled ? num(report.remit_transfer) : 0;

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

/* ------------------------------ PDF builders ------------------------------ */

async function createPdf(orientation) {
  // Dimuat dinamis supaya tidak membesarkan bundle halaman.
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.setProperties({ title: "Laporan Harian", creator: "Laporan Harian" });

  return { doc, autoTable: autoTableModule.default };
}

/* Garis marun tebal di atas baris total (foot), seperti border atas di Excel. */
function footRule(doc) {
  return (data) => {
    if (data.section !== "foot") return;
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.4);
    doc.line(
      data.cell.x,
      data.cell.y,
      data.cell.x + data.cell.width,
      data.cell.y,
    );
  };
}

function baseTableOptions(doc, fontSize) {
  return {
    theme: "grid",
    margin: { top: 12, left: MARGIN, right: MARGIN, bottom: FOOTER_SPACE },
    styles: {
      font: "helvetica",
      fontSize,
      cellPadding: 1.4,
      lineColor: COLORS.border,
      lineWidth: 0.1,
      textColor: COLORS.text,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      lineColor: COLORS.accent,
    },
    footStyles: {
      fillColor: COLORS.tint,
      textColor: COLORS.title,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: COLORS.zebra },
    rowPageBreak: "avoid",
    didDrawCell: footRule(doc),
  };
}

/* Band marun tua (judul + subjudul) dan strip aksen, seperti header PDF invoice. */
function drawBand(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, BAND_HEIGHT, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, BAND_HEIGHT, pageWidth, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(title, MARGIN, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.onDark);
  const lines = doc.splitTextToSize(pdfText(subtitle), pageWidth - MARGIN * 2);
  doc.text(lines.slice(0, 2), MARGIN, 17);

  return BAND_HEIGHT + 1.2 + 5;
}

function writeMeta(doc, startY, meta) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const valueX = MARGIN + 32;
  const valueWidth = pageWidth - MARGIN - valueX;
  let y = startY;

  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(pdfText(value), valueWidth);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.title);
    doc.text(pdfText(label), MARGIN, y, { baseline: "top" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    doc.text(lines, valueX, y, { baseline: "top" });

    y += lines.length * 4 + 1.2;
  });

  return y;
}

function writeNotes(doc, startY, notes, warningIndexes = []) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;
  let y = startY;

  notes.forEach((note, index) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", index === 0 ? "bold" : "normal");
    const lines = doc.splitTextToSize(pdfText(note), width);
    const height = lines.length * 3.6;

    if (y + height > pageHeight - FOOTER_SPACE) {
      doc.addPage();
      y = MARGIN + 2;
    }

    if (index === 0) doc.setTextColor(...COLORS.title);
    else if (warningIndexes.includes(index))
      doc.setTextColor(...COLORS.warning);
    else doc.setTextColor(...COLORS.muted);

    doc.text(lines, MARGIN, y, { baseline: "top" });
    y += height + 1;
  });

  return y;
}

/* Garis tipis + nomor halaman di setiap halaman. Dipanggil setelah semua konten. */
function addFooters(doc, label) {
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 9, pageWidth - MARGIN, pageHeight - 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, MARGIN, pageHeight - 5.5);
    doc.text(
      `Halaman ${page} dari ${total}`,
      pageWidth - MARGIN,
      pageHeight - 5.5,
      {
        align: "right",
      },
    );
  }
}

/* ------------------------- Export: banyak laporan ------------------------- */

async function exportReportsPdf(filters) {
  const { reports, totalAll } = await fetchAllReports(filters);

  if (reports.length === 0) {
    throw new Error("Belum ada laporan untuk diekspor.");
  }

  const truncated = totalAll > reports.length;
  const includeEntries = reports.length <= MAX_DETAIL_REPORTS;
  const details = includeEntries ? await fetchDetails(reports) : [];

  // Saldo awal, saldo akhir, dan saldo setelah disetor tidak dijumlahkan:
  // saldo setelah disetor satu hari menjadi saldo awal hari berikutnya, jadi
  // penjumlahannya menghitung dobel.
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

  const statusCounts = reports.reduce(
    (total, report) => {
      total[getRemitStatus(report).key] += 1;
      return total;
    },
    { unpaid: 0, paid: 0, approved: 0 },
  );

  const missingProof = reports.filter(
    (report) =>
      hasRemitAmounts(report) && needsProof(report) && !report.has_proof,
  ).length;
  const { doc, autoTable } = await createPdf("landscape");
  const options = baseTableOptions(doc, 6.5);

  /* ===================== Bagian 1: Ringkasan Laporan ===================== */

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
      `${formatNumber(statusCounts.approved)} approve owner, ${formatNumber(
        statusCounts.paid,
      )} sudah setor (belum approve), ${formatNumber(
        statusCounts.unpaid,
      )} belum disetor`,
    ],
  ];

  let y = drawBand(
    doc,
    "LAPORAN HARIAN",
    "Kas harian dipisah tunai dan non tunai: saldo awal, pemasukan, pengeluaran, setoran ke owner, dan saldo setelah disetor. Semua angka dalam Rupiah.",
  );
  y = writeMeta(doc, y, meta);

  const moneyCell = (value, color, bold = false) => ({
    content: formatNumber(value),
    styles: { textColor: color, fontStyle: bold ? "bold" : "normal" },
  });

  const body = reports.map((report, index) => {
    const f = figures(report);
    const closingTotal = f.closingCash + f.closingNoncash;
    const remainingTotal = f.remainingCash + f.remainingNoncash;
    const status = getRemitStatus(report);
    const proofRequired =
      hasRemitAmounts(report) && needsProof(report) && !report.has_proof;
    return [
      String(index + 1),
      shortDate(report.date),
      formatNumber(f.openingCash),
      formatNumber(f.openingNoncash),
      moneyCell(f.cashIn, COLORS.income),
      moneyCell(f.noncashIn, COLORS.income),
      moneyCell(f.cashOut, COLORS.danger),
      moneyCell(f.noncashOut, COLORS.danger),
      moneyCell(f.closingCash, COLORS.title, true),
      moneyCell(f.closingNoncash, COLORS.title, true),
      moneyCell(closingTotal, COLORS.title, true),
      formatNumber(f.remitCash),
      formatNumber(f.remitTransfer),
      formatNumber(f.remainingCash),
      formatNumber(f.remainingNoncash),
      moneyCell(remainingTotal, COLORS.title, true),
      formatNumber(num(report.entry_count)),
      {
        content: report.remitted
          ? `${status.label}\n${pdfText(formatDateTime(report.remitted_at))}`
          : status.label,
        styles: STATUS_STYLES[status.key],
      },
      {
        content: report.has_proof ? "Ada" : "Belum ada",
        styles: proofRequired
          ? { textColor: COLORS.danger, fontStyle: "bold" }
          : report.has_proof
            ? {}
            : { textColor: COLORS.muted },
      },
    ];
  });

  const foot = [
    [
      {
        content: `Total (${formatNumber(reports.length)} laporan)`,
        colSpan: 2,
        styles: { halign: "left" },
      },
      "", // 2 saldo awal tunai
      "", // 3 saldo awal non tunai
      formatNumber(sums.cashIn), // 4
      formatNumber(sums.noncashIn), // 5
      formatNumber(sums.cashOut), // 6
      formatNumber(sums.noncashOut), // 7
      "", // 8
      "", // 9
      "", // 10
      formatNumber(sums.remitCash), // 11
      formatNumber(sums.remitTransfer), // 12
      "", // 13
      "", // 14
      "", // 15
      formatNumber(sums.entries), // 16
      "", // 17
      "", // 18
    ],
  ];

  autoTable(doc, {
    ...options,
    startY: y + 1,
    head: SUMMARY_HEAD,
    body,
    foot,
    columnStyles: SUMMARY_COLUMN_STYLES,
  });
  const notes = [
    "Catatan:",
    "- Saldo akhir tunai = saldo awal tunai + masuk tunai - keluar tunai. Saldo akhir non tunai dihitung dengan cara yang sama.",
    "- Tunai hanya disetor tunai, non tunai hanya disetor lewat transfer. Saldo setelah disetor = saldo akhir - setoran, dan menjadi saldo awal laporan berikutnya.",
    "- Saldo awal, saldo akhir, dan saldo setelah disetor tidak dijumlahkan karena saldo setelah disetor satu hari menjadi saldo awal hari berikutnya.",
    "- Status: Belum disetor (admin belum mengisi setoran), Sudah setor (admin sudah mengisi, menunggu owner), Approve owner (sudah diapprove dan terkunci).",
    "- Laporan yang belum disetor dianggap belum menyetor apa pun, sehingga saldo setelah disetornya sama dengan saldo akhir. Pada laporan Sudah setor, angkanya dihitung dari isian admin dan baru final setelah owner meng-approve.",
    includeEntries
      ? "- Rincian setiap baris pemasukan dan pengeluaran ada di bagian Rincian Kas pada halaman berikutnya."
      : "- Rincian baris tidak disertakan karena jumlah laporan terlalu banyak. Persempit filter atau ekspor per laporan.",
  ];
  const warningIndexes = includeEntries ? [] : [6];

  if (missingProof > 0) {
    notes.push(
      `- ${formatNumber(missingProof)} laporan sudah setor dengan transfer tetapi belum ada bukti transfer.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  if (truncated) {
    notes.push(
      `- Hanya ${formatNumber(reports.length)} dari ${formatNumber(totalAll)} laporan yang berhasil diekspor.`,
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(doc, doc.lastAutoTable.finalY + 5, notes, warningIndexes);

  /* ======================== Bagian 2: Rincian Kas ======================== */

  if (includeEntries) {
    const flat = details.flatMap((report) =>
      (report.entries ?? []).map((entry) => ({ report, entry })),
    );

    doc.addPage();
    const entryStart = drawBand(
      doc,
      "RINCIAN KAS",
      `${formatNumber(flat.length)} baris dari ${formatNumber(reports.length)} laporan. Saldo adalah saldo berjalan gabungan tunai dan non tunai pada laporan masing-masing.`,
    );

    if (flat.length === 0) {
      autoTable(doc, {
        ...options,
        startY: entryStart,
        head: ENTRY_HEAD,
        body: [
          [
            {
              content: "Belum ada baris pemasukan atau pengeluaran.",
              colSpan: ENTRY_HEAD[0].length,
              styles: {
                halign: "center",
                fontStyle: "italic",
                textColor: COLORS.muted,
              },
            },
          ],
        ],
        columnStyles: ENTRY_COLUMN_STYLES,
      });
    } else {
      let incomeSum = 0;
      let expenseSum = 0;

      const entryBody = flat.map(({ report, entry }, index) => {
        const income = num(entry.income);
        const expense = num(entry.expense);

        incomeSum += income;
        expenseSum += expense;

        return [
          String(index + 1),
          shortDate(entry.date ?? report.date),
          text(methodLabel(entry.method)),
          {
            content: text(entry.name),
            styles: { fontStyle: "bold", textColor: COLORS.title },
          },
          text(entry.note),
          {
            content: rupiahDash(income),
            styles:
              income > 0 ? { fontStyle: "bold", textColor: COLORS.income } : {},
          },
          {
            content: rupiahDash(expense),
            styles:
              expense > 0
                ? { fontStyle: "bold", textColor: COLORS.danger }
                : {},
          },
          {
            content: rupiah(num(entry.balance)),
            styles: { fontStyle: "bold", textColor: COLORS.title },
          },
        ];
      });

      autoTable(doc, {
        ...options,
        startY: entryStart,
        head: ENTRY_HEAD,
        body: entryBody,
        foot: [
          [
            {
              content: `Total (${formatNumber(flat.length)} baris)`,
              colSpan: 5,
              styles: { halign: "left" },
            },
            rupiah(incomeSum),
            rupiah(expenseSum),
            "",
          ],
        ],
        columnStyles: ENTRY_COLUMN_STYLES,
      });
    }
  }

  addFooters(doc, "Laporan Harian");

  const from = filters?.date_from || "";
  const to = filters?.date_to || "";
  const range = from || to ? `${from || "awal"}_${to || "kini"}` : todayWib();

  doc.save(`laporan-harian_${range}.pdf`);
}

/* ------------------------- Export: satu laporan --------------------------- */

async function exportReportPdf(report) {
  const entries = report.entries ?? [];
  const f = figures(report);
  const openingTotal = f.openingCash + f.openingNoncash;
  const closingTotal = f.closingCash + f.closingNoncash;

  const proofLabel = report.proof
    ? "Ada"
    : needsProof(report)
      ? "Belum ada (wajib untuk setoran transfer)"
      : "Belum ada";

  const status = getRemitStatus(report);
  const filled = hasRemitAmounts(report);

  const meta = [
    ["Tanggal laporan", formatDate(report.date)],
    [
      "Status setoran",
      report.remitted
        ? `${status.label} (${formatDateTime(report.remitted_at)})`
        : status.label,
    ],
    [
      "Setoran",
      filled
        ? `Tunai ${rupiah(f.remitCash)} | Transfer ${rupiah(f.remitTransfer)}`
        : "Belum disetor",
    ],
    ["Bukti transfer", proofLabel],
    ["Diekspor pada", formatExportTimestamp()],
  ];

  const { doc, autoTable } = await createPdf("portrait");
  const options = baseTableOptions(doc, 7.5);

  let y = drawBand(doc, "LAPORAN HARIAN", formatDate(report.date));
  y = writeMeta(doc, y, meta);

  /* Baris saldo awal (gabungan) */
  const openingStyles = {
    fillColor: COLORS.tint,
    fontStyle: "bold",
    textColor: COLORS.title,
  };
  const openingRow = [
    {
      content: `Saldo awal   (Tunai ${rupiah(f.openingCash)} | Non tunai ${rupiah(f.openingNoncash)})`,
      colSpan: 6,
      styles: { ...openingStyles, halign: "left" },
    },
    { content: rupiah(openingTotal), styles: openingStyles },
  ];

  /* Baris catatan kas */
  let incomeSum = 0;
  let expenseSum = 0;

  const entryRows = entries.map((entry, index) => {
    const income = num(entry.income);
    const expense = num(entry.expense);

    incomeSum += income;
    expenseSum += expense;

    return [
      String(index + 1),
      text(methodLabel(entry.method)),
      {
        content: text(entry.name),
        styles: { fontStyle: "bold", textColor: COLORS.title },
      },
      text(entry.note),
      {
        content: rupiahDash(income),
        styles:
          income > 0 ? { fontStyle: "bold", textColor: COLORS.income } : {},
      },
      {
        content: rupiahDash(expense),
        styles:
          expense > 0 ? { fontStyle: "bold", textColor: COLORS.danger } : {},
      },
      {
        content: rupiah(num(entry.balance)),
        styles: { fontStyle: "bold", textColor: COLORS.title },
      },
    ];
  });

  autoTable(doc, {
    ...options,
    startY: y + 1,
    head: DETAIL_HEAD,
    body: [openingRow, ...entryRows],
    foot: [
      [
        {
          content: "Saldo akhir (tunai + non tunai)",
          colSpan: 4,
          styles: { halign: "left" },
        },
        rupiah(incomeSum),
        rupiah(expenseSum),
        rupiah(closingTotal),
      ],
    ],
    columnStyles: DETAIL_COLUMN_STYLES,
  });

  /* Rincian per metode, setoran, dan saldo setelah disetor */
  const breakdown = [
    ["Saldo akhir tunai", f.closingCash],
    ["Saldo akhir non tunai", f.closingNoncash],
    [filled ? "Disetor tunai" : "Disetor tunai (belum disetor)", f.remitCash],
    [
      filled ? "Disetor transfer" : "Disetor transfer (belum disetor)",
      f.remitTransfer,
    ],
    ["Saldo setelah disetor (tunai)", f.remainingCash],
    ["Saldo setelah disetor (non tunai)", f.remainingNoncash],
    ["Saldo setelah disetor (total)", f.remainingCash + f.remainingNoncash],
  ];

  const lastIndex = breakdown.length - 1;
  autoTable(doc, {
    ...options,
    startY: doc.lastAutoTable.finalY + 4,
    body: breakdown.map(([label, value], index) => {
      const styles =
        index === lastIndex
          ? {
              fillColor: COLORS.dark,
              textColor: COLORS.white,
              fontStyle: "bold",
            }
          : {
              fillColor: COLORS.tint,
              textColor: COLORS.title,
              fontStyle: "bold",
            };
      return [
        { content: label, styles: { ...styles, halign: "left" } },
        { content: rupiah(value), styles: { ...styles, halign: "right" } },
      ];
    }),
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 50 },
    },
  });

  const notes = [
    "Catatan:",
    "- Saldo dihitung berjalan dari saldo awal (tunai + non tunai) mengikuti urutan pencatatan.",
    "- Tunai hanya disetor tunai, non tunai hanya disetor lewat transfer. Saldo setelah disetor menjadi saldo awal laporan berikutnya.",
    report.remitted
      ? "- Laporan sudah di-approve owner dan terkunci."
      : filled
        ? "- Admin sudah mengisi setoran, menunggu approve owner. Saldo setelah disetor dihitung dari isian admin dan baru final setelah laporan di-approve."
        : "- Laporan belum disetor, sehingga saldo setelah disetor sama dengan saldo akhir.",
  ];
  const warningIndexes = [];

  if (entries.length === 0) {
    notes.push(
      "- Belum ada baris pemasukan atau pengeluaran pada laporan ini.",
    );
  }
  if (filled && needsProof(report) && !report.proof) {
    notes.push(
      "- Setoran transfer sudah diisi tetapi belum ada bukti transfer.",
    );
    warningIndexes.push(notes.length - 1);
  }
  writeNotes(doc, doc.lastAutoTable.finalY + 5, notes, warningIndexes);

  addFooters(doc, "Laporan Harian");

  doc.save(`laporan-harian_${report.date}.pdf`);
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
      notify.error(describeError(error) || "Gagal membuat file PDF.");
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
          <FiFileText size={16} aria-hidden="true" />
          Export PDF
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
      onExport={() => exportReportsPdf(filters)}
      successMessage="File PDF laporan harian berhasil diunduh."
    />
  );
}

/* Halaman detail: mengekspor satu laporan (data sudah dimuat, tanpa request). */
export function ExportReportButton({ report, disabled = false }) {
  return (
    <ExportButton
      disabled={disabled}
      onExport={() => exportReportPdf(report)}
      successMessage="File PDF laporan berhasil diunduh."
    />
  );
}
