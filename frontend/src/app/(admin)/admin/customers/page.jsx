"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCreditCard,
  FiLoader,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiUsers,
} from "react-icons/fi";

import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import { useGetCustomers } from "../../../features/customer/hooks.js";
import CustomerCard from "../../../../components/owner/customer-card.jsx";
import PrimaryButton from "./../../../../components/primary-button";
import RefreshButton from "../../../../components/refresh-button.jsx";
import CancelButton from "./../../../../components/cancel-button";

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

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "spent", label: "Belanja terbesar" },
  { value: "orders", label: "Pesanan terbanyak" },
  { value: "name", label: "Nama A–Z" },
];

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatPrice(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/* -------------------------- WhatsApp normalisasi -------------------------- */

/**
 * Normalisasi input nomor menjadi format kanonik "62..." (tanpa +, tanpa 0 di depan).
 *   "082123456789"  -> "6282123456789"
 *   "+62 821-2345"  -> "628212345"
 *   "628212345"     -> "628212345"
 *   "8212345"       -> "62812345"
 */
function normalizeWhatsapp(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

function sortCustomers(customers, sort) {
  const list = [...customers];

  switch (sort) {
    case "spent":
      return list.sort(
        (a, b) => (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0),
      );
    case "orders":
      return list.sort(
        (a, b) => (Number(b.order_count) || 0) - (Number(a.order_count) || 0),
      );
    case "name":
      return list.sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "id-ID"),
      );
    case "newest":
    default:
      return list.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
  }
}

function matchesQuery(customer, query) {
  const text = query.trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    customer.name,
    customer.id,
    customer.instagram,
    customer.address,
    customer.whatsapp,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes(text)) return true;

  // Cocokkan nomor WhatsApp setelah normalisasi ke format 62...
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 3) {
    const normalizedQuery = normalizeWhatsapp(digits);
    const normalizedCustomer = normalizeWhatsapp(customer.whatsapp);

    if (normalizedCustomer && normalizedCustomer.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MiniStatCard({ title, value, description, icon: Icon }) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/25"
        >
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-semibold text-second">{title}</h2>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tabular-nums tracking-tight text-second sm:text-3xl">
          {value}
        </p>
        <p className="mt-2 text-xs text-second/60">{description}</p>
      </div>
    </article>
  );
}

function FeaturedStatCard({ title, value, description, icon: Icon }) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl bg-grad p-4 text-primary shadow-lg shadow-second4/25 sm:p-8">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-second"
        >
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
          {value}
        </p>
        <p className="mt-2 text-xs text-primary/90">{description}</p>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second"
      >
        <Icon size={24} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-second">{title}</h2>
        <p className="mt-2 max-w-sm text-sm text-second/60">{message}</p>
      </div>

      {action}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
          <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-second/10" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertTriangle
          size={32}
          className="text-second2"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat pelanggan
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
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
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CustomersPage() {
  const { data, isPending, isError, error, isFetching, refetch } =
    useGetCustomers();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const customers = useMemo(() => {
    if (Array.isArray(data)) return data;
    return data?.data ?? data?.items ?? [];
  }, [data]);

  const paging = Array.isArray(data) ? null : (data?.paging ?? null);

  const visibleCustomers = useMemo(
    () =>
      sortCustomers(
        customers.filter((customer) => matchesQuery(customer, query)),
        sort,
      ),
    [customers, query, sort],
  );

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  const totalCustomers = paging?.total ?? customers.length;
  const isPartial = totalCustomers > customers.length;
  const scopeLabel = isPartial
    ? `Dari ${formatNumber(customers.length)} pelanggan yang dimuat`
    : "Dari seluruh pelanggan";

  const customersWithOrders = customers.filter(
    (customer) => Number(customer.order_count) > 0,
  ).length;

  const totalSpent = customers.reduce(
    (sum, customer) => sum + (Number(customer.total_spent) || 0),
    0,
  );

  const queryIsDigits =
    /\d/.test(query) && query.replace(/\D/g, "").length >= 3;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUsers size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Pelanggan</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Daftar pelanggan beserta kontak, jumlah pesanan, dan total
              belanja.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data pelanggan"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              aria-hidden="true"
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </RefreshButton>
          <PrimaryButton
            href="/admin/customers/create"
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            Buat Pelanggan
          </PrimaryButton>
        </div>
      </header>

      {/* Ringkasan */}
      <section
        aria-label="Ringkasan pelanggan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <FeaturedStatCard
          title="Total pelanggan"
          value={formatNumber(totalCustomers)}
          description="Seluruh pelanggan terdaftar"
          icon={FiUsers}
        />

        <MiniStatCard
          title="Pernah memesan"
          value={formatNumber(customersWithOrders)}
          description={scopeLabel}
          icon={FiShoppingBag}
        />

        <MiniStatCard
          title="Total belanja"
          value={formatPrice(totalSpent)}
          description={scopeLabel}
          icon={FiCreditCard}
        />
      </section>

      {/* Pencarian & sort */}
      <section aria-label="Daftar pelanggan" className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="customer-search" className={labelClass}>
              Cari pelanggan
            </label>

            <div className="flex">
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-second/60"
              >
                <FiSearch size={16} />
              </span>

              <input
                id="customer-search"
                name="customer-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama, WhatsApp (08…/62…), Instagram, atau alamat…"
                className={`${inputClass(false)} rounded-l-none`}
              />
            </div>

            {queryIsDigits && (
              <p className="mt-2 text-xs text-second/60">
                Mencari nomor WhatsApp sebagai{" "}
                <span className="font-mono font-semibold text-second">
                  {normalizeWhatsapp(query)}
                </span>
              </p>
            )}
          </div>

          <div className="sm:w-56">
            <label htmlFor="customer-sort" className={labelClass}>
              Urutkan
            </label>

            <select
              id="customer-sort"
              name="customer-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className={`${inputClass(false)}`}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="text-xs tabular-nums text-second/60"
            role="status"
            aria-live="polite"
          >
            Menampilkan {formatNumber(visibleCustomers.length)} dari{" "}
            {formatNumber(customers.length)} pelanggan
            {isPartial &&
              `. Total ${formatNumber(totalCustomers)} pelanggan, sisanya ada di halaman berikutnya.`}
          </p>

          {visibleCustomers.length > 0 && (
            <Tag tone="strong">
              {formatNumber(visibleCustomers.length)} ditampilkan
            </Tag>
          )}
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={FiUsers}
            title="Belum ada pelanggan"
            message="Pelanggan akan muncul di sini setelah ada yang membuat pesanan."
          />
        ) : visibleCustomers.length === 0 ? (
          <EmptyState
            icon={FiSearch}
            title="Pelanggan tidak ditemukan"
            message="Coba kata kunci lain atau hapus pencarian."
            action={
              <CancelButton
                type="button"
                onClick={() => setQuery("")}
                className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Hapus pencarian
              </CancelButton>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleCustomers.map((customer) => (
              <li key={customer.id} className="min-w-0">
                <CustomerCard customer={customer} admin />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
