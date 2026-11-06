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
  FiUsers,
  FiX,
} from "react-icons/fi";

import { useGetReportCustomers } from "../../../../features/reports/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import * as XLSX from "xlsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const BACK_PATH = "/owner/reports";
const CUSTOMER_DETAIL_PATH = (id) => `/owner/customers/${id}`;

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
  { value: "revenue", label: "Omzet" },
  { value: "orders", label: "Order" },
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

/* ------------------------------ Error Mapping ----------------------------- */

function explainError(error) {
  const status = error?.response?.status;

  if (status === 404) {
    return {
      title: "Data customer belum tersedia",
      description:
        "Server tidak menemukan data untuk permintaan ini. Coba ubah rentang tanggal, kata kunci, atau tekan Coba lagi.",
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
    title: "Gagal memuat laporan customer",
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

export default function CustomersReportPage() {
  const [today] = useState(wibToday);

  const [presetKey, setPresetKey] = useState("30d");
  const [range, setRange] = useState(() => PRESETS[1].range(wibToday()));
  const [draft, setDraft] = useState(range);
  const [sort, setSort] = useState("revenue");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const invalidRange =
    draft.from !== "" && draft.to !== "" && draft.from > draft.to;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useGetReportCustomers({
    ...range,
    sort,
    search,
    limit: PER_PAGE,
    page: currentPage,
  });

  const customers = query.data?.data ?? [];
  const paging = query.data?.paging;
  const metric = query.data?.sort ?? sort;

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? PER_PAGE;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const totals = useMemo(() => {
    return customers.reduce(
      (acc, c) => ({
        orders: acc.orders + (c.sales?.orders ?? 0),
        revenue: acc.revenue + (c.sales?.revenue ?? 0),
        profit: acc.profit + (c.sales?.profit ?? 0),
      }),
      { orders: 0, revenue: 0, profit: 0 },
    );
  }, [customers]);

  const hasFilters = search !== "" || presetKey !== "30d" || sort !== "revenue";

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
    setSort("revenue");
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  }

  function handleExport() {
    const ws = XLSX.utils.json_to_sheet(
      customers.map((c) => ({
        Customer: c.name,
        WhatsApp: c.whatsapp ?? "",
        Tipe: c.type === "NEW" ? "Baru" : "Berulang",
        Order: c.sales.orders,
        Omzet: c.sales.revenue,
        Laba: c.sales.profit,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer");
    XLSX.writeFile(wb, `customer-${range.from}-${range.to}.xlsx`);
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
              <FiUsers size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Laporan <span className="text-grad">Customer</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Customer yang bertransaksi lunas di periode ini. Belum dikurangi
                refund.
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
              disabled={customers.length === 0}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              <FiDownload size={16} aria-hidden="true" />
              Export Excel
            </button>
          </div>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter laporan customer"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Pilih rentang tanggal, urutkan, atau cari customer.
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
              Cari customer
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
                placeholder="Cari nama atau WhatsApp customer…"
                className={`${inputClass(false)} pl-8`}
                maxLength={100}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <p className={labelClass}>Urutkan</p>
            <Segmented
              label="Urutkan customer"
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
      {customers.length > 0 && (
        <section
          aria-label="Ringkasan halaman"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/25">
              <FiUsers size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-second/60">Order lunas</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-second">
                {formatNumber(totals.orders)}
              </p>
            </div>
          </article>
          <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second3 text-primary shadow-lg shadow-second3/25">
              <FiShoppingBag size={16} aria-hidden="true" />
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
          <h2 className="text-lg font-bold text-second">Daftar customer</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} customer
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

      {/* Daftar customer */}
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

        {customers.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${query.isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-second/[0.03] text-xs text-second/70">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Tipe
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
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-second/10">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="transition-colors hover:bg-second4/5"
                    >
                      <td className="px-4 py-4">
                        <p className="break-words text-sm font-semibold text-second">
                          {customer.name}
                        </p>
                        {customer.whatsapp && (
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {customer.whatsapp}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {customer.type === "NEW" && <Tag tone="blue">Baru</Tag>}
                        {customer.type === "RETURNING" && (
                          <Tag tone="violet">Berulang</Tag>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second">
                        {formatNumber(customer.sales.orders)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second">
                        {formatRupiah(customer.sales.revenue)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second3">
                        {formatRupiah(customer.sales.profit)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={CUSTOMER_DETAIL_PATH(customer.id)}
                          className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {customers.map((customer) => (
                <li key={customer.id}>
                  <Link
                    href={CUSTOMER_DETAIL_PATH(customer.id)}
                    className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second group-hover:text-second4">
                          {customer.name}
                        </p>
                        {customer.whatsapp && (
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {customer.whatsapp}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {customer.type === "NEW" && <Tag tone="blue">Baru</Tag>}
                        {customer.type === "RETURNING" && (
                          <Tag tone="violet">Berulang</Tag>
                        )}
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-second/30 pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-second/60">Order</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {formatNumber(customer.sales.orders)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-second/60">Omzet</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {formatRupiah(customer.sales.revenue)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-second/60">Laba</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second3">
                          {formatRupiah(customer.sales.profit)}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiUsers size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters
                ? "Customer tidak ditemukan"
                : "Belum ada transaksi customer"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada customer yang cocok dengan filter atau pencarian."
                : "Transaksi customer akan muncul di sini setelah ada order lunas."}
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
          aria-label="Paginasi customer"
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
