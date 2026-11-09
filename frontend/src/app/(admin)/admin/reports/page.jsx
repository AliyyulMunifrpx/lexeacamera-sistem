"use client";

import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiInfo,
  FiLoader,
  FiPackage,
  FiRefreshCw,
  FiRotateCcw,
  FiShoppingBag,
} from "react-icons/fi";

import { useGetAdminSales } from "../../../features/admin-sales/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN DASHBOARD / INVOICE)                         */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 merah, second3 biru, second4 ungu)  */
/*  Info saja: tanpa modal, laba, dan margin.                                 */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

// Hanya "Rentang" yang memakai tanggal. Periode lain selalu periode berjalan (WIB).
const PERIODS = [
  { value: "day", label: "Hari ini" },
  { value: "week", label: "Pekan ini" },
  { value: "month", label: "Bulan ini" },
  { value: "year", label: "Tahun ini" },
  { value: "range", label: "Rentang" },
  { value: "all", label: "Semua" },
];

const PERIOD_HINT = {
  day: "Penjualan hari ini (WIB).",
  week: "Pekan ini, dari Senin sampai Minggu.",
  month: "Bulan ini, dari tanggal 1 sampai akhir bulan.",
  year: "Tahun ini, dari 1 Januari sampai 31 Desember.",
  range: "Pilih tanggal awal dan akhir. Keduanya wajib diisi.",
  all: "Seluruh penjualan sejak awal.",
};

const DEFAULT_RANGE_DAYS = 30;

// Respons cepat tetap menampilkan animasi putar cukup lama agar terlihat.
const MIN_REFRESH_MS = 600;

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

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "-" : "";

  return `${sign}${new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`;
}

// Tanggal hari ini menurut WIB (UTC+7), format YYYY-MM-DD.
function wibToday() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
}

function formatDay(isoDate, options) {
  if (!isoDate) return "";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function describePeriod(period) {
  if (!period) return "";

  const { type, from, to } = period;

  if (type === "all" || (!from && !to)) return "Sepanjang waktu";

  if (type === "day" || from === to) {
    return formatDay(from, { day: "numeric", month: "long", year: "numeric" });
  }

  if (type === "month") {
    return formatDay(from, { month: "long", year: "numeric" });
  }

  if (type === "year") return formatDay(from, { year: "numeric" });

  return `${formatDay(from, { day: "numeric", month: "short" })} – ${formatDay(
    to,
    { day: "numeric", month: "short", year: "numeric" },
  )}`;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    failure: "bg-second2 text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false, tag }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 text-xs tabular-nums ${
              featured ? "text-primary/90" : "text-second/60"
            }`}
          >
            {hint}
          </p>
        )}
        {tag && <div className="mt-2">{tag}</div>}
      </div>
    </article>
  );
}

function Section({ icon: Icon, title, description, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-second">{title}</h2>
            {description && (
              <p className="mt-2 text-pretty text-sm text-second/60">
                {description}
              </p>
            )}
          </div>
        </div>
        {aside}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-2xl bg-second/10"
        />
      ))}
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function AdminSalesPage() {
  const today = wibToday();

  const [period, setPeriod] = useState("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const rangeIncomplete = period === "range" && (!from || !to);
  const rangeInvalid = period === "range" && from && to && from > to;
  const canFetch = !rangeIncomplete && !rangeInvalid;

  const { data, isPending, isError, error, isFetching, refetch } =
    useGetAdminSales({ period, from, to }, { enabled: canFetch });

  useEffect(() => {
    if (!isError || !error) return;

    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const sales = data?.sales ?? { orders: 0, units: 0, revenue: 0 };
  const refunds = data?.refunds ?? { orders: 0, units: 0, amount: 0 };
  const net = data?.net ?? { units: 0, revenue: 0 };

  const refundRatio =
    sales.revenue > 0 ? (refunds.amount / sales.revenue) * 100 : 0;
  const refundBar = Math.min(100, Math.max(0, refundRatio));
  const refundExceeds = refunds.amount > sales.revenue;
  const hasData = sales.orders > 0 || refunds.orders > 0;

  const showLoading = canFetch && isPending;
  const showError = canFetch && isError && !data;

  async function handleRefresh() {
    if (isRefreshing || !canFetch) return;

    const startedAt = Date.now();
    setIsRefreshing(true);

    try {
      await refetch();
    } finally {
      const remaining = Math.max(0, MIN_REFRESH_MS - (Date.now() - startedAt));
      setTimeout(() => setIsRefreshing(false), remaining);
    }
  }

  function handlePeriodChange(next) {
    setPeriod(next);

    // Rentang langsung terisi 30 hari terakhir agar data tampil tanpa menunggu input.
    if (next === "range" && (!from || !to)) {
      setFrom(addDays(today, -(DEFAULT_RANGE_DAYS - 1)));
      setTo(today);
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
              Reports <span className="text-grad">Penjualan</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Omzet, jumlah order, dan unit terjual dari order yang sudah lunas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || !canFetch}
          aria-busy={isRefreshing}
          aria-label="Perbarui data penjualan"
          className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
        >
          <FiRefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {isRefreshing ? "Memperbarui…" : "Perbarui"}
        </button>
      </header>

      {/* Filter periode */}
      <section
        aria-label="Filter periode"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div
          role="group"
          aria-label="Jenis periode"
          className="flex flex-wrap gap-2"
        >
          {PERIODS.map((option) => {
            const active = period === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => handlePeriodChange(option.value)}
                className={`${BTN_BASE} ${
                  active
                    ? "bg-grad text-primary shadow-lg shadow-second4/25"
                    : "border border-second/30 text-second hover:border-second4 hover:text-second4"
                } ${FOCUS_RING}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {period === "range" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
            <div className="min-w-0">
              <label htmlFor="sales-from" className={labelClass}>
                Dari tanggal
              </label>
              <input
                id="sales-from"
                type="date"
                value={from}
                max={to || today}
                onChange={(event) => setFrom(event.target.value)}
                aria-invalid={rangeInvalid ? true : undefined}
                className={inputClass(Boolean(rangeInvalid))}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="sales-to" className={labelClass}>
                Sampai tanggal
              </label>
              <input
                id="sales-to"
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(event) => setTo(event.target.value)}
                aria-invalid={rangeInvalid ? true : undefined}
                className={inputClass(Boolean(rangeInvalid))}
              />
            </div>
          </div>
        )}

        {rangeInvalid ? (
          <p role="alert" className="text-sm text-second2">
            Tanggal awal tidak boleh melewati tanggal akhir.
          </p>
        ) : (
          <p className="text-sm text-second/60">{PERIOD_HINT[period]}</p>
        )}
      </section>

      {/* Konten */}
      {!canFetch ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
            <FiBarChart2 size={24} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-second">
            {rangeInvalid ? "Rentang tanggal tidak valid" : "Lengkapi rentang"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {rangeInvalid
              ? "Perbaiki tanggal awal dan akhir untuk melihat penjualan."
              : "Isi tanggal awal dan akhir untuk melihat penjualan."}
          </p>
        </div>
      ) : showLoading ? (
        <LoadingState />
      ) : showError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat data penjualan
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, kemudian coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isFetching ? (
              <FiLoader
                size={16}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <FiRefreshCw size={16} aria-hidden="true" />
            )}
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      ) : (
        <div
          className={`flex flex-col gap-8 transition-opacity duration-200 ${
            isFetching ? "opacity-60" : "opacity-100"
          }`}
          aria-busy={isFetching}
        >
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <Tag tone="strong">{describePeriod(data?.period)}</Tag>
            {!hasData && <Tag>Belum ada penjualan lunas</Tag>}
          </div>

          {/* Stat cards */}
          <section
            aria-label="Ringkasan penjualan"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              featured
              icon={FiBarChart2}
              label="Omzet bersih"
              value={formatCurrency(net.revenue)}
              hint="Penjualan dikurangi refund"
            />
            <StatCard
              icon={FiShoppingBag}
              label="Order lunas"
              value={formatNumber(sales.orders)}
              hint={`${formatNumber(sales.units)} unit terjual`}
            />
            <StatCard
              icon={FiPackage}
              label="Unit terjual bersih"
              value={formatNumber(net.units)}
              hint={`${formatNumber(sales.units)} terjual − ${formatNumber(refunds.units)} refund`}
            />
            <StatCard
              icon={FiRotateCcw}
              label="Refund lunas"
              value={formatCurrency(refunds.amount)}
              hint={`${formatNumber(refunds.orders)} refund · ${formatNumber(refunds.units)} unit`}
            />
          </section>

          {/* Rincian */}
          <Section
            icon={FiCheckCircle}
            title="Rincian"
            description="Penjualan lunas dikurangi refund lunas pada periode yang sama."
          >
            <div className="overflow-hidden rounded-xl ">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <caption className="sr-only">
                    Rincian penjualan, refund, dan hasil bersih
                  </caption>
                  <thead className="bg-grad text-sm text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        &nbsp;
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Order
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
                        Nilai
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-second/10 text-sm tabular-nums">
                    <tr>
                      <th
                        scope="row"
                        className="px-4 py-4 text-left font-semibold text-second"
                      >
                        Penjualan lunas
                      </th>
                      <td className="px-4 py-4 text-right text-second/70">
                        {formatNumber(sales.orders)}
                      </td>
                      <td className="px-4 py-4 text-right text-second/70">
                        {formatNumber(sales.units)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-second">
                        {formatCurrency(sales.revenue)}
                      </td>
                    </tr>

                    <tr className=" bg-second3/20">
                      <th
                        scope="row"
                        className="px-4 py-4 text-left font-semibold text-second"
                      >
                        Refund lunas
                      </th>
                      <td className="px-4 py-4 text-right text-second/70">
                        {formatNumber(refunds.orders)}
                      </td>
                      <td className="px-4 py-4 text-right text-second/70">
                        {formatNumber(refunds.units)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-second2">
                        {refunds.amount > 0
                          ? `− ${formatCurrency(refunds.amount)}`
                          : formatCurrency(0)}
                      </td>
                    </tr>
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-second/30 bg-second/[0.03] text-sm tabular-nums">
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-bold text-second"
                      >
                        Bersih
                      </th>
                      <td className="px-4 py-3 text-right text-second/60">—</td>
                      <td className="px-4 py-3 text-right font-bold text-second">
                        {formatNumber(net.units)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-second">
                        {formatCurrency(net.revenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Rasio refund */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-second/60">
                  Refund terhadap penjualan
                </span>
                <span className="font-semibold tabular-nums text-second">
                  {sales.revenue > 0
                    ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(refundRatio)}%`
                    : "—"}
                </span>
              </div>

              <div
                role="img"
                aria-label={
                  sales.revenue > 0
                    ? `Refund sebesar ${Math.round(refundRatio)} persen dari penjualan`
                    : "Belum ada penjualan pada periode ini"
                }
                className="h-2 overflow-hidden rounded-full bg-second/10"
              >
                <div
                  className="h-full rounded-full bg-second2 transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${refundBar}%` }}
                />
              </div>

              {refundExceeds && (
                <p className="mt-2">
                  <Tag tone="failure">Refund melebihi penjualan</Tag>
                </p>
              )}
            </div>
          </Section>

          <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-sm text-second4">
            <FiInfo size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Hanya order yang sudah lunas yang dihitung, berdasarkan tanggal
            lunas (WIB). Refund dihitung pada tanggal refund dilunasi, sehingga
            hasil bersih bisa negatif jika refund lebih besar dari penjualan di
            periode yang sama.
          </p>
        </div>
      )}
    </div>
  );
}
