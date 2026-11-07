"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiLoader,
  FiPercent,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";

import { useGetReportProducts } from "../../../../features/reports/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
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

const SORT_OPTIONS = [
  { value: "units", label: "Terlaris" },
  { value: "revenue", label: "Omzet" },
  { value: "profit", label: "Laba" },
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

/* -------------------------------- Number utils ---------------------------- */

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function formatRupiah(value = 0) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(rounded))}`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${String(Number(value.toFixed(2))).replace(".", ",")}%`;
}

function netUnits(product) {
  return (product.sales?.units ?? 0) - (product.refunds?.units ?? 0);
}

/* ------------------------------ Excel export ------------------------------ */

const XLSX_COLORS = {
  brand: "FF4F46E5",
  brandText: "FFFFFFFF",
  title: "FF1E1B4B",
  muted: "FF6B7280",
  zebra: "FFF5F5FB",
  border: "FFD9D9E3",
  total: "FFE8E8F5",
  profit: "FF047857",
  warning: "FFB45309",
};

const XLSX_RUPIAH = '"Rp" #,##0;[Red]-"Rp" #,##0';
const XLSX_NUMBER = "#,##0";
const XLSX_PERCENT = "0.00%";

const XLSX_COLUMN_COUNT = 10;
const XLSX_HEADER_ROW = 10;

const XLSX_HEADERS = [
  { label: "No", width: 6, align: "center" },
  { label: "Produk", width: 40, align: "left" },
  { label: "Kategori", width: 20, align: "left" },
  { label: "Unit terjual", width: 14, align: "right" },
  { label: "Unit refund", width: 14, align: "right" },
  { label: "Unit bersih", width: 14, align: "right" },
  { label: "Omzet bersih", width: 20, align: "right" },
  { label: "HPP bersih", width: 20, align: "right" },
  { label: "Laba bersih", width: 20, align: "right" },
  { label: "Margin", width: 12, align: "right" },
];

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

async function exportProductsXlsx({
  products,
  range,
  sortLabel,
  search,
  paging,
}) {
  const ExcelJS = (await import("exceljs")).default;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Laporan Produk";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Laporan Produk", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${XLSX_HEADER_ROW}:${XLSX_HEADER_ROW}`,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    headerFooter: {
      oddFooter: "&LLaporan Produk&RHalaman &P dari &N",
    },
  });

  sheet.columns = XLSX_HEADERS.map((column) => ({ width: column.width }));

  const lastColumn = XLSX_COLUMN_COUNT;
  const thinBorder = {
    top: { style: "thin", color: { argb: XLSX_COLORS.border } },
    left: { style: "thin", color: { argb: XLSX_COLORS.border } },
    bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
    right: { style: "thin", color: { argb: XLSX_COLORS.border } },
  };

  /* ----- Judul ----- */
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "LAPORAN PRODUK";
  titleCell.font = { size: 18, bold: true, color: { argb: XLSX_COLORS.title } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, lastColumn);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value =
    "Produk terjual berdasarkan order lunas, sudah dikurangi refund.";
  subtitleCell.font = {
    size: 10,
    italic: true,
    color: { argb: XLSX_COLORS.muted },
  };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  /* ----- Keterangan ----- */
  const total = paging?.total ?? products.length;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const page = paging?.page ?? 1;

  const meta = [
    [
      "Periode",
      `${formatPeriod(range.from, range.to)} (${daysBetween(range.from, range.to)} hari)`,
    ],
    ["Diekspor pada", formatExportTimestamp()],
    ["Diurutkan berdasarkan", sortLabel],
    ["Pencarian", search || "Semua produk"],
    [
      "Cakupan data",
      `Halaman ${page} dari ${totalPages} (${products.length} dari ${total} produk)`,
    ],
  ];

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
    valueCell.alignment = { vertical: "middle", horizontal: "left" };
  });

  /* ----- Header tabel ----- */
  const headerRow = sheet.getRow(XLSX_HEADER_ROW);
  headerRow.height = 26;
  XLSX_HEADERS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: XLSX_COLORS.brandText } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: XLSX_COLORS.brand },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: column.align === "left" ? "left" : "center",
      wrapText: true,
    };
    cell.border = thinBorder;
  });

  /* ----- Data ----- */
  const firstDataRow = XLSX_HEADER_ROW + 1;
  const sums = {
    sold: 0,
    refunded: 0,
    units: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
  };

  products.forEach((product, index) => {
    const sold = product.sales?.units ?? 0;
    const refunded = product.refunds?.units ?? 0;
    const units = netUnits(product);
    const revenue = product.net?.revenue ?? 0;
    const cost = product.net?.cost ?? 0;
    const profit = product.net?.profit ?? 0;
    const margin = product.net?.margin_pct;

    sums.sold += sold;
    sums.refunded += refunded;
    sums.units += units;
    sums.revenue += revenue;
    sums.cost += cost;
    sums.profit += profit;

    const row = sheet.getRow(firstDataRow + index);
    row.values = [
      index + 1,
      product.name,
      product.category?.name ?? "Tanpa kategori",
      sold,
      refunded,
      units,
      revenue,
      cost,
      profit,
      margin === null || margin === undefined ? "-" : margin / 100,
    ];

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > lastColumn) return;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: "middle",
        horizontal: XLSX_HEADERS[col - 1].align,
        wrapText: col === 2,
      };
      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: XLSX_COLORS.zebra },
        };
      }
    });

    [4, 5, 6].forEach((col) => (row.getCell(col).numFmt = XLSX_NUMBER));
    [7, 8, 9].forEach((col) => (row.getCell(col).numFmt = XLSX_RUPIAH));
    row.getCell(10).numFmt = XLSX_PERCENT;
    row.getCell(9).font = { bold: true, color: { argb: XLSX_COLORS.profit } };
  });

  const lastDataRow = firstDataRow + products.length - 1;

  /* ----- Total ----- */
  const totalRowNumber = lastDataRow + 1;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.height = 24;
  sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 3);
  totalRow.getCell(1).value = "Total halaman ini";

  const sumCell = (col, letter, result, numFmt) => {
    const cell = totalRow.getCell(col);
    cell.value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
      result,
    };
    cell.numFmt = numFmt;
  };

  sumCell(4, "D", sums.sold, XLSX_NUMBER);
  sumCell(5, "E", sums.refunded, XLSX_NUMBER);
  sumCell(6, "F", sums.units, XLSX_NUMBER);
  sumCell(7, "G", sums.revenue, XLSX_RUPIAH);
  sumCell(8, "H", sums.cost, XLSX_RUPIAH);
  sumCell(9, "I", sums.profit, XLSX_RUPIAH);

  const marginCell = totalRow.getCell(10);
  marginCell.value = {
    formula: `IF(G${totalRowNumber}=0,"-",I${totalRowNumber}/G${totalRowNumber})`,
    result: sums.revenue > 0 ? sums.profit / sums.revenue : "-",
  };
  marginCell.numFmt = XLSX_PERCENT;

  for (let col = 1; col <= lastColumn; col += 1) {
    const cell = totalRow.getCell(col);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.title } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: XLSX_COLORS.total },
    };
    cell.border = {
      ...thinBorder,
      top: { style: "medium", color: { argb: XLSX_COLORS.brand } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col === 1 ? "left" : "right",
    };
  }

  /* ----- Catatan ----- */
  const notes = [
    "Catatan:",
    "• Hanya order berstatus lunas yang dihitung. Unit, omzet, HPP, dan laba sudah dikurangi refund.",
    "• HPP bersih = modal barang terjual dikurangi modal barang refund yang kembali ke stok.",
    "• Margin = laba bersih dibagi omzet bersih.",
  ];
  if (totalPages > 1) {
    notes.push(
      "• File ini hanya berisi produk pada halaman yang dipilih. Pindah halaman lalu export lagi untuk produk lainnya.",
    );
  }

  notes.forEach((text, index) => {
    const rowNumber = totalRowNumber + 2 + index;
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
              argb:
                totalPages > 1 && index === notes.length - 1
                  ? XLSX_COLORS.warning
                  : XLSX_COLORS.muted,
            },
          };
  });

  sheet.autoFilter = {
    from: { row: XLSX_HEADER_ROW, column: 1 },
    to: { row: lastDataRow, column: lastColumn },
  };

  /* ----- Unduh ----- */
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-produk_${range.from}_sd_${range.to}${
    totalPages > 1 ? `_hal-${page}` : ""
  }.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ------------------------------ Error Mapping ----------------------------- */

function explainError(error) {
  const status = error?.response?.status;

  if (status === 404) {
    return {
      title: "Data produk belum tersedia",
      description:
        "Server tidak menemukan data untuk permintaan ini. Coba ubah rentang tanggal, kata kunci, atau tekan Coba lagi.",
    };
  }
  if (status === 401) {
    return {
      title: "Sesi Anda telah berakhir",
      description: "Silakan login ulang untuk memuat laporan ini.",
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
    title: "Gagal memuat laporan produk",
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

/* ---------------------------------- Page --------------------------------- */

export default function ProductsReportPage() {
  const [today] = useState(wibToday);

  const [presetKey, setPresetKey] = useState("30d");
  const [range, setRange] = useState(() => PRESETS[1].range(wibToday()));
  const [draft, setDraft] = useState(range);
  const [sort, setSort] = useState("units");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const invalidRange =
    draft.from !== "" && draft.to !== "" && draft.from > draft.to;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useGetReportProducts({
    ...range,
    sort,
    search,
    limit: PER_PAGE,
    page: currentPage,
  });

  const products = query.data?.data ?? [];
  const paging = query.data?.paging;
  const metric = query.data?.sort ?? sort;

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? PER_PAGE;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const totals = useMemo(() => {
    return products.reduce(
      (acc, p) => ({
        units: acc.units + netUnits(p),
        revenue: acc.revenue + (p.net?.revenue ?? 0),
        profit: acc.profit + (p.net?.profit ?? 0),
      }),
      { units: 0, revenue: 0, profit: 0 },
    );
  }, [products]);

  const hasFilters = search !== "" || presetKey !== "30d" || sort !== "units";

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
    setSort("units");
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  }

  async function handleExport() {
    if (isExporting || products.length === 0) return;

    setIsExporting(true);
    try {
      await exportProductsXlsx({
        products,
        range,
        sortLabel:
          SORT_OPTIONS.find((option) => option.value === metric)?.label ??
          metric,
        search,
        paging,
      });
    } catch (error) {
      console.error(error);
      notify.error("Gagal membuat file Excel. Coba lagi.");
    } finally {
      setIsExporting(false);
    }
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
              <FiShoppingBag size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Laporan <span className="text-grad">Produk</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Produk terjual berdasarkan order lunas. Sudah dikurangi refund.
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
              disabled={products.length === 0 || isExporting}
              aria-busy={isExporting}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              {isExporting ? (
                <FiLoader
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <FiDownload size={16} aria-hidden="true" />
              )}
              {isExporting ? "Menyiapkan file…" : "Export Excel"}
            </button>
          </div>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter laporan produk"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Pilih rentang tanggal, urutkan, atau cari produk.
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="report-search" className={labelClass}>
              Cari produk
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
                placeholder="Cari nama produk…"
                className={`${inputClass(false)} pl-8`}
                maxLength={100}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>Urutkan</p>
            <Segmented
              label="Urutkan produk"
              value={sort}
              onChange={(value) => {
                setSort(value);
                setCurrentPage(1);
              }}
              options={SORT_OPTIONS}
            />
          </div>
        </div>
      </section>

      {/* Ringkasan halaman */}
      {products.length > 0 && (
        <section
          aria-label="Ringkasan halaman"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/25">
              <FiShoppingBag size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-second/60">Unit terjual</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatNumber(totals.units)}
              </p>
            </div>
          </article>
          <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second3 text-primary shadow-lg shadow-second3/25">
              <FiTrendingUp size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-second/60">Omzet</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatRupiah(totals.revenue)}
              </p>
            </div>
          </article>
          <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second4 text-primary shadow-lg shadow-second4/25">
              <FiPercent size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-second/60">Laba</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatRupiah(totals.profit)}
              </p>
            </div>
          </article>
        </section>
      )}

      {/* Judul daftar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar produk</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} produk
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

      {/* Daftar produk */}
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

        {products.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${query.isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl  bg-primary shadow-xl shadow-second/5 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Produk
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
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Margin
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-second/10">
                  {products.map((product, i) => {
                    const margin = product.net.margin_pct;
                    return (
                      <tr
                        key={product.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                      >
                        <td className="px-4 py-4">
                          <p className="break-words text-sm font-semibold text-second">
                            {product.name}
                          </p>
                          {product.sku && (
                            <p className="mt-2 font-mono text-xs text-second/60">
                              SKU {product.sku}
                            </p>
                          )}
                          {product.refunds?.units > 0 && (
                            <p className="mt-2 text-xs tabular-nums text-second/60">
                              Sudah dikurangi refund{" "}
                              {formatNumber(product.refunds.units)} unit
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second">
                          {formatNumber(netUnits(product))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second">
                          {formatRupiah(product.net.revenue)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second3">
                          {formatRupiah(product.net.profit)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {formatPercent(margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {products.map((product) => {
                const margin = product.net.margin_pct;
                return (
                  <li key={product.id}>
                    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second">
                          {product.name}
                        </p>
                        {product.sku && (
                          <p className="mt-2 font-mono text-xs text-second/60">
                            SKU {product.sku}
                          </p>
                        )}
                        {product.refunds?.units > 0 && (
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            Sudah dikurangi refund{" "}
                            {formatNumber(product.refunds.units)} unit
                          </p>
                        )}
                      </div>

                      <dl className="grid grid-cols-2 gap-4 border-t border-second/30 pt-4 text-sm">
                        <div>
                          <dt className="text-xs text-second/60">Unit</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second">
                            {formatNumber(netUnits(product))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-second/60">Omzet</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second">
                            {formatRupiah(product.net.revenue)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-second/60">Laba</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second3">
                            {formatRupiah(product.net.profit)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-second/60">Margin</dt>
                          <dd className="mt-2 font-semibold tabular-nums text-second">
                            {formatPercent(margin)}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiShoppingBag size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters
                ? "Produk tidak ditemukan"
                : "Belum ada penjualan produk"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada produk yang cocok dengan filter atau pencarian."
                : "Penjualan produk akan muncul di sini setelah ada order lunas."}
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
          aria-label="Paginasi produk"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || query.isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || query.isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
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
