"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic.js";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBox,
  FiCornerUpLeft,
  FiPercent,
  FiRefreshCw,
  FiShoppingBag,
  FiTrendingUp,
} from "react-icons/fi";

import {
  useGetReportCustomers,
  useGetReportCustomersSummary,
  useGetReportProducts,
  useGetReportStockValue,
  useGetReportSummary,
  useGetReportTransactions,
  useGetReportTrend,
} from "../../../features/reports/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import PrimaryButton from "./../../../../components/primary-button";
import { useQueryClient } from "@tanstack/react-query";
const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,

  loading: () => <ChartSkeleton />,
});

const PRODUCTS_REPORT_PATH = "/owner/reports/products";
const CUSTOMERS_REPORT_PATH = "/owner/reports/customers";
const TRANSACTIONS_REPORT_PATH = "/owner/reports/transactions";
const STOCK_REPORT_PATH = "/owner/reports/stock";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

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

const COLOR = {
  ink: "#000000",
  blue: "#2563eb",
  violet: "#7c3aed",
  red: "#dc2626",
};
const AXIS_TEXT = "rgba(0, 0, 0, 0.6)";
const GRID = "rgba(0, 0, 0, 0.08)";

// Respons cepat tetap menampilkan animasi putar cukup lama agar terlihat.
const MIN_REFRESH_MS = 600;

const TREND_LIMIT_DAYS = { day: 366, week: 1100, month: 3700 };

/* ------------------------------ Error Mapping ----------------------------- */

function explainError(error, { context = "reports" } = {}) {
  const status = error?.response?.status;
  const code = error?.response?.data?.errors;

  if (code === "ORDER_NOT_FOUND") {
    return {
      tone: "failure",
      title: "Data reports tidak ditemukan",
      description:
        "Reports tidak tersedia untuk periode ini. Coba ubah rentang tanggal atau perbarui data.",
      canRetry: true,
    };
  }

  if (status === 404) {
    return {
      tone: "failure",
      title: `Data ${context} belum tersedia`,
      description:
        "Server tidak menemukan data untuk permintaan ini. Ini biasanya karena rentang tanggal kosong, filter tidak cocok, atau data belum dibuat. Coba ubah rentang tanggal atau tekan Coba lagi.",
      canRetry: true,
    };
  }

  if (status === 401) {
    return {
      tone: "pending",
      title: "Sesi Anda telah berakhir",
      description: "Silakan login ulang untuk memuat reports ini.",
      canRetry: false,
    };
  }

  if (status === 403) {
    return {
      tone: "pending",
      title: "Anda tidak punya akses",
      description:
        "Akun Anda tidak punya izin untuk membuka reports ini. Hubungi pemilik toko.",
      canRetry: false,
    };
  }

  if (status === 429) {
    return {
      tone: "pending",
      title: "Terlalu banyak permintaan",
      description:
        "Tunggu sebentar lalu coba lagi. Permintaan dibatasi untuk menjaga performa server.",
      canRetry: true,
    };
  }

  if (status >= 500) {
    return {
      tone: "failure",
      title: "Server sedang bermasalah",
      description:
        "Terjadi kesalahan di server. Coba lagi beberapa saat, atau hubungi pemilik toko jika terus berlanjut.",
      canRetry: true,
    };
  }

  if (error?.code === "ERR_NETWORK" || status === undefined) {
    return {
      tone: "failure",
      title: "Koneksi ke server gagal",
      description:
        "Periksa koneksi internet Anda. Jika internet normal, coba lagi beberapa saat.",
      canRetry: true,
    };
  }

  return {
    tone: "failure",
    title: "Gagal memuat reports",
    description:
      normalizeApiError(error).message || "Terjadi kesalahan tak terduga.",
    canRetry: true,
  };
}

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

function autoGroup(from, to) {
  const days = daysBetween(from, to);
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

function formatDateLabel(value, group) {
  const date = new Date(parseDay(value));
  if (group === "month") {
    return date.toLocaleDateString("id-ID", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

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

function formatTransactionDate(value) {
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

function formatCompact(value = 0) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n) => String(Number(n.toFixed(1))).replace(".", ",");
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} rb`;
  return `${sign}${Math.round(abs)}`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${String(Number(value.toFixed(2))).replace(".", ",")}%`;
}

/* ------------------------------ Small pieces ------------------------------ */

function ChartSkeleton({ height = 260 }) {
  return (
    <div
      role="status"
      aria-label="Memuat grafik"
      style={{ height }}
      className="animate-pulse rounded-xl bg-second/10"
    />
  );
}

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    red: "bg-second2/10 text-second2",
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
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`${BTN_BASE} ${
              active
                ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                : "border border-second/30 text-second hover:border-second4 hover:text-second4"
            } disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Error State ------------------------------- */

function QueryErrorState({
  error,
  context,
  onRetry,
  isFetching,
  compact = false,
}) {
  const info = explainError(error, { context });

  if (compact) {
    return (
      <div
        role="alert"
        className={`flex flex-col items-start gap-3 rounded-xl border px-4 py-3 ${
          info.tone === "pending"
            ? "border-second4/30 bg-second4/5 text-second4"
            : "border-second2/30 bg-second2/5 text-second2"
        }`}
      >
        <div className="flex items-start gap-2">
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{info.title}</p>
            <p className="mt-1 text-xs leading-relaxed">{info.description}</p>
          </div>
        </div>

        {info.canRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isFetching}
            className={`${BTN_BASE} border border-current/40 hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={14}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-12 text-center"
    >
      <div
        className={`flex size-16 items-center justify-center rounded-full ${
          info.tone === "pending"
            ? "bg-second4/10 text-second4"
            : "bg-second2/10 text-second2"
        }`}
      >
        <FiAlertTriangle size={28} aria-hidden="true" />
      </div>

      <h2 className="mt-4 text-lg font-bold text-second">{info.title}</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-second/60">
        {info.description}
      </p>

      {info.canRetry && onRetry && (
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
      )}
    </div>
  );
}

/* --------------------------------- Panel --------------------------------- */

function Panel({
  title,
  subtitle,
  actions,
  query,
  isEmpty,
  emptyText,
  children,
  skeletonHeight,
  context = "reports",
}) {
  const showSkeleton = query.isPending;
  const showError = query.isError && !query.data;

  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {subtitle && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>

      <div className="min-w-0">
        {showSkeleton ? (
          <ChartSkeleton height={skeletonHeight} />
        ) : showError ? (
          <QueryErrorState
            error={query.error}
            context={context}
            onRetry={() => query.refetch()}
            isFetching={query.isFetching}
            compact
          />
        ) : isEmpty ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-second/20 px-4 text-center text-sm text-second/60">
            {emptyText}
          </div>
        ) : (
          <div
            className={`transition-opacity duration-200 ${
              query.isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Chart options ----------------------------- */

const BASE_OPTIONS = {
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: "inherit",
    foreColor: AXIS_TEXT,
    animations: { enabled: true, speed: 350 },
  },
  grid: { borderColor: GRID, strokeDashArray: 3 },
  dataLabels: { enabled: false },
  legend: { show: false },
  states: { active: { filter: { type: "none" } } },
};

function trendOptions(points, group) {
  return {
    ...BASE_OPTIONS,
    chart: { ...BASE_OPTIONS.chart, type: "area" },
    colors: [COLOR.blue, COLOR.violet],
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.18,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    markers: { size: 0, hover: { size: 5 } },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      markers: { size: 6, offsetX: -2 },
      itemMargin: { horizontal: 12 },
    },
    xaxis: {
      categories: points.map((point) => formatDateLabel(point.date, group)),
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        style: { fontSize: "11px" },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      tickAmount: Math.min(points.length - 1, 6),
    },
    yaxis: {
      labels: {
        formatter: (value) => formatCompact(value),
        style: { fontSize: "11px" },
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (value) => formatRupiah(value) },
    },
  };
}

function verticalBarOptions({ names, color, valueFormatter, axisFormatter }) {
  return {
    ...BASE_OPTIONS,
    chart: { ...BASE_OPTIONS.chart, type: "bar" },
    colors: [color],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "50%",
        borderRadius: 6,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: names,
      labels: {
        rotate: -25,
        rotateAlways: false,
        trim: true,
        style: { fontSize: "11px" },
        formatter: (value) =>
          value && value.length > 14 ? `${value.slice(0, 14)}…` : value,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: axisFormatter,
        style: { fontSize: "11px" },
      },
    },
    grid: {
      ...BASE_OPTIONS.grid,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    tooltip: { y: { formatter: valueFormatter } },
  };
}

function donutOptions({ labels, colors, centerLabel, centerValue }) {
  return {
    ...BASE_OPTIONS,
    chart: { ...BASE_OPTIONS.chart, type: "donut" },
    labels,
    colors,
    stroke: { width: 2, colors: ["#ffffff"] },
    legend: {
      show: true,
      position: "bottom",
      fontSize: "12px",
      markers: { size: 6 },
      itemMargin: { horizontal: 10 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            name: { show: true, fontSize: "12px" },
            value: {
              show: true,
              fontSize: "22px",
              fontWeight: 700,
              color: COLOR.ink,
            },
            total: {
              show: true,
              showAlways: true,
              label: centerLabel,
              fontSize: "12px",
              formatter: () => centerValue,
            },
          },
        },
      },
    },
    tooltip: { y: { formatter: (value) => `${formatNumber(value)} customer` } },
  };
}

/* --------------------------------- Panels --------------------------------- */

function TrendPanel({ range, groupChoice, onGroupChange }) {
  const days = daysBetween(range.from, range.to);
  const group =
    days <= TREND_LIMIT_DAYS[groupChoice] && groupChoice !== "auto"
      ? groupChoice
      : autoGroup(range.from, range.to);

  const query = useGetReportTrend({ group, from: range.from, to: range.to });
  const points = query.data?.data ?? [];
  const resolvedGroup = query.data?.group ?? group;

  const series = useMemo(
    () => [
      { name: "Omzet bersih", data: points.map((point) => point.net.revenue) },
      { name: "Laba bersih", data: points.map((point) => point.net.profit) },
    ],
    [points],
  );
  const options = useMemo(
    () => trendOptions(points, resolvedGroup),
    [points, resolvedGroup],
  );

  const groupOptions = [
    { value: "day", label: "Harian", disabled: days > TREND_LIMIT_DAYS.day },
    {
      value: "week",
      label: "Mingguan",
      disabled: days > TREND_LIMIT_DAYS.week,
    },
    {
      value: "month",
      label: "Bulanan",
      disabled: days > TREND_LIMIT_DAYS.month,
    },
  ];

  return (
    <Panel
      title="Tren omzet & laba"
      subtitle="Omzet dan laba bersih (setelah refund) per periode."
      query={query}
      skeletonHeight={300}
      isEmpty={points.length === 0}
      emptyText="Belum ada data penjualan pada periode ini."
      context="tren penjualan"
      actions={
        <Segmented
          label="Pengelompokan tren"
          value={resolvedGroup}
          onChange={onGroupChange}
          options={groupOptions}
        />
      }
    >
      <div
        role="img"
        aria-label={`Grafik tren omzet dan laba bersih ${resolvedGroup}, ${formatPeriod(range.from, range.to)}.`}
      >
        <Chart type="area" height={400} series={series} options={options} />
      </div>
    </Panel>
  );
}

function CustomerMixPanel({ range }) {
  const query = useGetReportCustomersSummary(range);
  const summary = query.data;

  const newCount = summary?.new?.customers ?? 0;
  const returningCount = summary?.returning?.customers ?? 0;

  const options = useMemo(
    () =>
      donutOptions({
        labels: ["Customer baru", "Customer berulang"],
        colors: [COLOR.blue, COLOR.violet],
        centerLabel: "Repeat rate",
        centerValue: formatPercent(summary?.repeat_rate_pct),
      }),
    [summary?.repeat_rate_pct],
  );

  return (
    <Panel
      title="Customer baru vs berulang"
      subtitle="Baru: order lunas pertamanya di periode ini. Berulang: sudah pernah beli lunas sebelumnya."
      query={query}
      skeletonHeight={300}
      isEmpty={
        summary &&
        newCount + returningCount === 0 &&
        (summary.unassigned?.orders ?? 0) === 0
      }
      emptyText="Belum ada penjualan lunas pada periode ini."
      context="customer"
    >
      {summary && newCount + returningCount > 0 ? (
        <div
          role="img"
          aria-label={`Customer aktif ${summary.active_customers}: ${newCount} baru, ${returningCount} berulang. Repeat rate ${formatPercent(summary.repeat_rate_pct)}.`}
        >
          <Chart
            type="donut"
            height={280}
            series={[newCount, returningCount]}
            options={options}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-second/[0.03] px-4 py-2 text-sm text-second/60">
          Semua penjualan periode ini berasal dari order tanpa customer.
        </p>
      )}
    </Panel>
  );
}

const PRODUCT_SORTS = [
  { value: "units", label: "Terlaris" },
  { value: "revenue", label: "Omzet" },
  { value: "profit", label: "Laba" },
];

function TopProductsPanel({ range }) {
  const [sort, setSort] = useState("units");
  const query = useGetReportProducts({ ...range, sort, limit: 5 });

  const products = query.data?.data ?? [];
  const metric = query.data?.sort ?? sort;

  const series = useMemo(
    () => [
      {
        name: PRODUCT_SORTS.find((item) => item.value === metric)?.label ?? "",
        data: products.map(
          (product) => product.sales[metric === "units" ? "units" : metric],
        ),
      },
    ],
    [products, metric],
  );

  const options = useMemo(
    () =>
      verticalBarOptions({
        names: products.map((product) => product.name),
        color: COLOR.blue,
        valueFormatter:
          metric === "units"
            ? (value) => `${formatNumber(value)} unit`
            : (value) => formatCompact(value),
        axisFormatter:
          metric === "units"
            ? (value) => formatNumber(value)
            : (value) => formatCompact(value),
      }),
    [products, metric],
  );

  return (
    <Panel
      title="5 produk teratas"
      subtitle="Berdasarkan penjualan lunas, belum dikurangi refund."
      query={query}
      skeletonHeight={280}
      isEmpty={products.length === 0}
      emptyText="Belum ada penjualan produk pada periode ini."
      context="produk"
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Urutkan produk"
          value={sort}
          onChange={setSort}
          options={PRODUCT_SORTS}
        />

        <div
          role="img"
          aria-label={`Lima produk teratas: ${products.map((p) => `${p.name} ${p.sales.units} unit`).join(", ")}.`}
        >
          <Chart type="bar" height={300} series={series} options={options} />
        </div>

        <PrimaryButton href={PRODUCTS_REPORT_PATH} className="mt-auto">
          Lihat semua produk
          <FiArrowRight size={16} aria-hidden="true" />
        </PrimaryButton>
      </div>
    </Panel>
  );
}

const CUSTOMER_SORTS = [
  { value: "revenue", label: "Omzet" },
  { value: "orders", label: "Order" },
  { value: "profit", label: "Laba" },
];

function TopCustomersPanel({ range }) {
  const [sort, setSort] = useState("revenue");
  const query = useGetReportCustomers({ ...range, sort, limit: 5 });

  const customers = query.data?.data ?? [];
  const metric = query.data?.sort ?? sort;
  const valueOf = (customer) => customer.sales[metric];
  const maxValue = Math.max(
    1,
    ...customers.map((customer) => Math.abs(valueOf(customer))),
  );

  return (
    <Panel
      title="5 customer teratas"
      subtitle="Berdasarkan penjualan lunas, belum dikurangi refund."
      query={query}
      skeletonHeight={280}
      isEmpty={customers.length === 0}
      emptyText="Belum ada penjualan ke customer pada periode ini."
      context="customer"
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Urutkan customer"
          value={sort}
          onChange={setSort}
          options={CUSTOMER_SORTS}
        />

        <ol className="flex flex-col gap-4">
          {customers.map((customer, index) => {
            const value = valueOf(customer);
            const width = Math.max(2, (Math.abs(value) / maxValue) * 100);

            return (
              <li key={customer.id} className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second/10 text-xs font-bold tabular-nums text-second"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-second">
                        {customer.name}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        {formatNumber(customer.sales.orders)} order ·{" "}
                        {formatNumber(customer.sales.units)} unit
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm font-bold tabular-nums text-second">
                      {metric === "orders"
                        ? `${formatNumber(value)} order`
                        : formatRupiah(value)}
                    </span>
                    {customer.type === "NEW" && <Tag tone="blue">Baru</Tag>}
                    {customer.type === "RETURNING" && (
                      <Tag tone="violet">Berulang</Tag>
                    )}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-second/10"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: COLOR.blue }}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        <PrimaryButton href={CUSTOMERS_REPORT_PATH} className="mt-auto">
          Lihat semua customer
          <FiArrowRight size={16} aria-hidden="true" />
        </PrimaryButton>
      </div>
    </Panel>
  );
}

/* ------------------------- Transactions Preview --------------------------- */

function TransactionsPreviewPanel({ range }) {
  const query = useGetReportTransactions({ ...range, limit: 5 });
  const transactions = query.data?.data ?? [];
  const totals = query.data?.totals;

  return (
    <Panel
      title="Rincian transaksi"
      subtitle="Order lunas (penjualan dan refund) di periode ini. Refund bernilai negatif."
      query={query}
      skeletonHeight={200}
      isEmpty={transactions.length === 0}
      emptyText="Belum ada transaksi lunas pada periode ini."
      context="transaksi"
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-xl border border-second/30">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-grad text-sm text-primary">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Invoice
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tanggal
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Tipe
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Omzet
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Laba
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-second/10">
              {transactions.map((tx, i) => {
                const isRefund = tx.type === "REFUND";
                return (
                  <tr
                    key={tx.id}
                    className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-second">
                      {tx.invoice_no ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-second/80">
                      {tx.customer_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-second/60">
                      {formatTransactionDate(tx.paid_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Tag tone={isRefund ? "red" : "blue"}>
                        {isRefund ? "Refund" : "Penjualan"}
                      </Tag>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                      {formatRupiah(tx.revenue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                      {formatRupiah(tx.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t border-second/30 bg-second/[0.03]">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-right text-xs font-semibold text-second/60"
                  >
                    Total periode ({formatNumber(totals.orders)} order){" "}
                  </td>
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

        <PrimaryButton href={TRANSACTIONS_REPORT_PATH} className="mt-auto">
          Lihat semua transaksi
          <FiArrowRight size={16} aria-hidden="true" />
        </PrimaryButton>
      </div>
    </Panel>
  );
}

/* --------------------------- Stock Value Preview -------------------------- */

function StockValuePanel() {
  const query = useGetReportStockValue();
  const data = query.data;
  const stock = data?.stock;
  const purchased = data?.purchased;
  const categories = data?.by_category ?? [];

  return (
    <Panel
      title="Nilai stok"
      subtitle="Posisi persediaan hari ini (bukan per periode). Hanya kamera aktif dengan stok > 0."
      query={query}
      skeletonHeight={200}
      isEmpty={!stock}
      emptyText="Belum ada data stok."
      context="nilai stok"
    >
      {stock && (
        <div className="flex flex-col gap-4 ">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-second/[0.03] p-3">
              <dt className="text-xs text-second/60">Produk</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatNumber(stock.products)}
              </dd>
            </div>
            <div className="rounded-xl bg-second/[0.03] p-3">
              <dt className="text-xs text-second/60">Unit</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatNumber(stock.units)}
              </dd>
            </div>
            <div className="rounded-xl bg-second/[0.03] p-3">
              <dt className="text-xs text-second/60">Nilai modal</dt>
              <dd className="mt-1 text-sm font-bold tabular-nums text-second">
                {formatRupiah(stock.cost_value)}
              </dd>
            </div>
            <div className="rounded-xl bg-second/[0.03] p-3">
              <dt className="text-xs text-second/60">Nilai jual</dt>
              <dd className="mt-1 text-sm font-bold tabular-nums text-second">
                {formatRupiah(stock.price_value)}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl bg-grad p-4 text-primary shadow-lg shadow-second4/25">
            <p className="text-xs text-primary/90">Potensi profit</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatRupiah(stock.potential_profit)}
            </p>
            <p className="mt-1 text-xs text-primary/80">
              Jika semua stok terjual penuh
            </p>
          </div>

          {categories.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-second/30">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Kategori
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
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
                      Nilai modal
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Nilai jual
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-second/10">
                  {categories.map((cat, index) => (
                    <tr
                      key={cat.id ?? `no-category-${index}`}
                      className={`align-top transition-colors hover:bg-second/20 ${index % 2 === 0 ? "" : "bg-second3/20"}`}
                    >
                      <td className="px-4 py-3 text-second/80">
                        {cat.name ?? "Tanpa kategori"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                        {formatNumber(cat.products)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                        {formatNumber(cat.units)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                        {formatRupiah(cat.cost_value)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-second">
                        {formatRupiah(cat.price_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PrimaryButton href={STOCK_REPORT_PATH} className="mt-auto">
            Lihat detail stok
            <FiArrowRight size={16} aria-hidden="true" />
          </PrimaryButton>
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function ReportsOverviewPage() {
  const [today] = useState(wibToday);

  const [presetKey, setPresetKey] = useState("30d");
  const [range, setRange] = useState(() => PRESETS[1].range(wibToday()));
  const [draft, setDraft] = useState(range);
  const [groupChoice, setGroupChoice] = useState("auto");

  const invalidRange =
    draft.from !== "" && draft.to !== "" && draft.from > draft.to;
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const summaryQuery = useGetReportSummary(range);
  const summary = summaryQuery.data;

  function applyPreset(preset) {
    const next = preset.range(today);
    setPresetKey(preset.key);
    setRange(next);
    setDraft(next);
    setGroupChoice("auto");
  }

  function updateDraft(key, value) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setPresetKey("custom");
    if (next.from && next.to && next.from <= next.to) {
      setRange(next);
      setGroupChoice("auto");
    }
  }

  // Semua query di halaman ini aktif, jadi cukup refetch semua query aktif.
  // Tidak bergantung pada awalan queryKey di hooks.
  async function refreshAll() {
    if (isRefreshing) return;

    const startedAt = Date.now();
    setIsRefreshing(true);

    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      const remaining = Math.max(0, MIN_REFRESH_MS - (Date.now() - startedAt));
      setTimeout(() => setIsRefreshing(false), remaining);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiBarChart2 size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Reports</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Ringkasan penjualan, laba, produk, dan customer. Hanya order lunas
              yang dihitung, berdasarkan tanggal lunas (WIB).
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={refreshAll}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            aria-label="Perbarui reports"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
            {isRefreshing ? "Memperbarui…" : "Perbarui"}
          </button>
        </div>
      </header>

      {/* Periode */}
      <section
        aria-label="Periode reports"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Periode</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Pilih rentang waktu, atau gunakan preset cepat.
          </p>
        </div>

        <Segmented
          label="Periode cepat"
          value={presetKey}
          onChange={(key) =>
            applyPreset(PRESETS.find((preset) => preset.key === key))
          }
          options={PRESETS.map((preset) => ({
            value: preset.key,
            label: preset.label,
          }))}
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
            Tanggal awal tidak boleh lebih besar dari tanggal akhir. Reports
            masih menampilkan periode sebelumnya.
          </p>
        ) : (
          <p className="text-xs tabular-nums text-second/60" aria-live="polite">
            Menampilkan {formatPeriod(range.from, range.to)} (
            {daysBetween(range.from, range.to)} hari).
          </p>
        )}
      </section>

      {/* Error ringkasan */}
      {summaryQuery.isError && !summary && (
        <QueryErrorState
          error={summaryQuery.error}
          context="ringkasan reports"
          onRetry={() => summaryQuery.refetch()}
          isFetching={summaryQuery.isFetching}
        />
      )}

      {/* Stat cards mini */}
      {(!summaryQuery.isError || summary) && (
        <section
          aria-label="Ringkasan"
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 ${summaryQuery.isFetching && summary ? "opacity-60" : ""}`}
        >
          <MiniStatCard
            icon={FiTrendingUp}
            label="Omzet bersih"
            tone="neutral"
            value={
              summaryQuery.isPending
                ? "…"
                : summary
                  ? formatRupiah(summary.net.revenue)
                  : "—"
            }
            hint={
              summary ? `Penjualan ${formatRupiah(summary.sales.revenue)}` : ""
            }
          />
          <MiniStatCard
            icon={FiPercent}
            label="Laba bersih"
            tone="success"
            value={
              summaryQuery.isPending
                ? "…"
                : summary
                  ? formatRupiah(summary.net.profit)
                  : "—"
            }
            hint={
              summary ? `Margin ${formatPercent(summary.net.margin_pct)}` : ""
            }
          />
          <MiniStatCard
            icon={FiShoppingBag}
            label="Order lunas"
            tone="neutral"
            value={
              summaryQuery.isPending
                ? "…"
                : summary
                  ? formatNumber(summary.sales.orders)
                  : "—"
            }
            hint={
              summary ? `${formatNumber(summary.sales.units)} unit terjual` : ""
            }
          />
          <MiniStatCard
            icon={FiBarChart2}
            label="Rata-rata order"
            tone="neutral"
            value={
              summaryQuery.isPending
                ? "…"
                : summary
                  ? formatRupiah(summary.sales.avg_order_value ?? 0)
                  : "—"
            }
            hint="Nilai per order"
          />
          <MiniStatCard
            icon={FiCornerUpLeft}
            label="Refund"
            tone="failure"
            value={
              summaryQuery.isPending
                ? "…"
                : summary
                  ? formatRupiah(summary.refunds.amount)
                  : "—"
            }
            hint={
              summary
                ? `${formatNumber(summary.refunds.orders)} order refund`
                : ""
            }
          />
        </section>
      )}

      {/* Grafik baris 1: tren + produk teratas */}
      <section
        aria-label="Grafik tren dan produk"
        className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      >
        <TrendPanel
          range={range}
          groupChoice={groupChoice}
          onGroupChange={setGroupChoice}
        />
        <TopProductsPanel range={range} />
      </section>

      {/* Grafik baris 2: customer mix + top customer */}
      <section
        aria-label="Grafik customer"
        className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      >
        <CustomerMixPanel range={range} />
        <TopCustomersPanel range={range} />
      </section>

      {/* Rincian transaksi + nilai stok */}
      <section
        aria-label="Rincian transaksi dan nilai stok"
        className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      >
        <TransactionsPreviewPanel range={range} />
        <StockValuePanel />
      </section>
    </div>
  );
}
