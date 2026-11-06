"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiLoader,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiX,
} from "react-icons/fi";

import { useGetOwnerOrders } from "../../../features/orders/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import PrimaryButton from "../../../../components/primary-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/* -------------------------------------------------------------------------- */

const ORDER_DETAIL_PATH = (id) => `/owner/orders/${id}`;

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
      : "border-second/30 hover:border-second/60 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

const TYPE_OPTIONS = [
  { value: "", label: "Semua jenis" },
  { value: "SALE", label: "Penjualan" },
  { value: "REFUND", label: "Refund" },
];

const PAYMENT_OPTIONS = [
  { value: "", label: "Semua pembayaran" },
  { value: "PAID", label: "Lunas" },
  { value: "UNPAID", label: "Belum lunas" },
];

const DATE_FIELD_OPTIONS = [
  { value: "created_at", label: "Tanggal order dibuat" },
  { value: "paid_at", label: "Tanggal lunas" },
];

const TYPE_LABEL = { SALE: "Penjualan", REFUND: "Refund" };
const PAYMENT_LABEL = { PAID: "Lunas", UNPAID: "Belum lunas" };

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatPrice(price = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function money(value) {
  return value === null || value === undefined ? "—" : formatPrice(value);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
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
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function PaymentTag({ status }) {
  const isPaid = status === "PAID";
  return (
    <Tag
      tone={isPaid ? "success" : "pending"}
      icon={isPaid ? FiCheckCircle : FiClock}
    >
      {PAYMENT_LABEL[status] ?? status ?? "—"}
    </Tag>
  );
}

function ProfitText({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-second/50">—</span>;
  }
  return (
    <span
      className={`font-semibold tabular-nums ${
        value < 0 ? "text-second2" : "text-second3"
      }`}
    >
      {formatPrice(value)}
    </span>
  );
}

function SummaryCard({ label, count, amount, icon: Icon, featured = false }) {
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
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {formatPrice(amount)}
        </p>
        <p
          className={`mt-2 text-xs tabular-nums ${
            featured ? "text-primary/90" : "text-second/60"
          }`}
        >
          {formatNumber(count)} order
        </p>
      </div>
    </article>
  );
}

function Field({ id, label, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DetailButton({ orderId, className = "" }) {
  return (
    <PrimaryButton href={ORDER_DETAIL_PATH(orderId)}>
      Detail
      <FiArrowRight size={16} aria-hidden="true" />
    </PrimaryButton>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function OwnerOrdersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateField, setDateField] = useState("created_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const invalidRange = dateFrom !== "" && dateTo !== "" && dateFrom > dateTo;

  const query = useGetOwnerOrders({
    search,
    type,
    payment_status: paymentStatus,
    date_field: dateFrom || dateTo ? dateField : "",
    date_from: invalidRange ? "" : dateFrom,
    date_to: invalidRange ? "" : dateTo,
    page: currentPage,
  });
  const { data, isPending, isError, isFetching, error, refetch } = query;

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const orders = data?.data ?? [];
  const summary = data?.summary;
  const paging = data?.paging;

  const paid = summary?.paid ?? { count: 0, amount: 0 };
  const unpaid = summary?.unpaid ?? { count: 0, amount: 0 };
  const totalAmount = paid.amount + unpaid.amount;
  const paidShare = totalAmount > 0 ? (paid.amount / totalAmount) * 100 : 0;

  const totalOrders = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? orders.length;
  const startItem = totalOrders === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, totalOrders);

  const activeFilterCount = [
    search,
    type,
    paymentStatus,
    dateFrom,
    dateTo,
  ].filter((value) => value !== "").length;
  const hasFilters = activeFilterCount > 0;

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setPaymentStatus("");
    setDateField("created_at");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShoppingBag size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Semua <span className="text-grad">Order</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Pantau penjualan, status pembayaran, modal, dan laba setiap
                order.
              </p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat data order
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau filter Anda, lalu coba kembali.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
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
      </div>
    );
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
            <FiShoppingBag size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Semua <span className="text-grad">Order</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Pantau penjualan, status pembayaran, modal, dan laba setiap order.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data order"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>
        </div>
      </header>

      {/* Banner error partial */}
      {isError && data && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <FiAlertTriangle size={16} aria-hidden="true" />
            Gagal memperbarui data. Menampilkan data terakhir.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className={`${BTN_BASE} w-fit border border-second2/40 text-second2 hover:bg-second2/10 ${FOCUS_RING}`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Ringkasan */}
      <section
        aria-label="Ringkasan pembayaran"
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            featured
            label="Order lunas"
            count={paid.count}
            amount={paid.amount}
            icon={FiCheckCircle}
          />
          <SummaryCard
            label="Order belum lunas"
            count={unpaid.count}
            amount={unpaid.amount}
            icon={FiClock}
          />
        </div>

        <div>
          <div
            role="img"
            aria-label={`${Math.round(paidShare)} persen nominal sudah lunas`}
            className="h-2 overflow-hidden rounded-full bg-second/10"
          >
            <div
              className="h-full rounded-full bg-grad transition-[width] duration-300"
              style={{ width: `${paidShare}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-second/60">
            Ringkasan hanya menghitung order penjualan dan mengikuti pencarian
            serta tanggal, tidak mengikuti filter jenis dan pembayaran.
          </p>
        </div>
      </section>

      {/* Filter */}
      <section
        aria-label="Filter order"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Persempit daftar order berdasarkan kata kunci, jenis, status
            pembayaran, atau rentang tanggal.
          </p>
        </div>

        <div className="relative">
          <FiSearch
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
          />
          <label htmlFor="order-search" className="sr-only">
            Cari order
          </label>
          <input
            id="order-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder="Cari nomor invoice, nama, ID pelanggan, atau WhatsApp…"
            className={`${inputClass(false)} pl-8`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field id="order-type" label="Jenis">
            <select
              id="order-type"
              value={type}
              onChange={(event) => updateFilter(setType, event.target.value)}
              className={inputClass(false)}
            >
              {TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="order-payment" label="Pembayaran">
            <select
              id="order-payment"
              value={paymentStatus}
              onChange={(event) =>
                updateFilter(setPaymentStatus, event.target.value)
              }
              className={inputClass(false)}
            >
              {PAYMENT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="order-date-field" label="Tanggal berdasarkan">
            <select
              id="order-date-field"
              value={dateField}
              onChange={(event) =>
                updateFilter(setDateField, event.target.value)
              }
              className={inputClass(false)}
            >
              {DATE_FIELD_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="order-date-from" label="Dari tanggal">
            <input
              id="order-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) =>
                updateFilter(setDateFrom, event.target.value)
              }
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </Field>

          <Field id="order-date-to" label="Sampai tanggal">
            <input
              id="order-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => updateFilter(setDateTo, event.target.value)}
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </Field>
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
          <p className="text-xs text-second/60">
            Tanggal memakai zona waktu WIB dan sudah termasuk tanggal awal dan
            akhir.
          </p>
        )}
      </section>

      {/* Judul daftar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar order</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(totalOrders)} order
          </p>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong" icon={FiSearch}>
              {activeFilterCount} filter aktif
            </Tag>
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

      {/* Daftar order */}
      <div className="relative min-h-40">
        {isFetching && (
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

        {orders.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {/* Tabel (desktop) */}
            <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-grad text-xs text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Order
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Pelanggan
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Item
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Total
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Modal
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
                    {orders.map((order, i) => (
                      <tr
                        key={order.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={ORDER_DETAIL_PATH(order.id)}
                            className={`break-all rounded-sm font-mono text-sm font-semibold text-second underline-offset-4 hover:text-second4 hover:underline ${FOCUS_RING}`}
                          >
                            {order.no_invoice ?? order.id}
                          </Link>
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {TYPE_LABEL[order.type] ?? order.type} ·{" "}
                            {formatDate(order.created_at)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="break-words text-sm font-semibold text-second">
                            {order.customer_name ?? "—"}
                          </p>
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {order.whatsapp ?? "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <PaymentTag status={order.payment_status} />
                            {order.type === "REFUND" && (
                              <Tag tone="failure">Refund</Tag>
                            )}
                          </div>
                          {order.paid_at && (
                            <p className="mt-2 text-xs tabular-nums text-second/60">
                              Lunas {formatDate(order.paid_at)}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {formatNumber(order.item_count ?? 0)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second">
                          {formatPrice(order.total_amount)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {money(order.capital_total)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums">
                          <ProfitText value={order.profit} />
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <DetailButton orderId={order.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kartu (mobile & tablet) */}
            <ul className="flex flex-col gap-4 lg:hidden">
              {orders.map((order) => (
                <li key={order.id}>
                  <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={ORDER_DETAIL_PATH(order.id)}
                          className={`break-all rounded-sm font-mono text-sm font-semibold text-second underline-offset-4 hover:text-second4 hover:underline ${FOCUS_RING}`}
                        >
                          {order.no_invoice ?? order.id}
                        </Link>
                        <p className="mt-2 text-xs tabular-nums text-second/60">
                          {TYPE_LABEL[order.type] ?? order.type} ·{" "}
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <PaymentTag status={order.payment_status} />
                        {order.type === "REFUND" && (
                          <Tag tone="failure">Refund</Tag>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-second">
                        {order.customer_name ?? "—"}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        {order.whatsapp ?? "—"} ·{" "}
                        {formatNumber(order.item_count ?? 0)} barang
                      </p>
                      <p className="mt-4 text-lg font-bold tabular-nums text-second">
                        {formatPrice(order.total_amount)}
                      </p>
                    </div>

                    <dl className="grid grid-cols-2 gap-4 border-t border-second/30 pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-second/60">Modal</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {money(order.capital_total)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-second/60">Laba</dt>
                        <dd className="mt-2">
                          <ProfitText value={order.profit} />
                        </dd>
                      </div>
                    </dl>

                    <DetailButton orderId={order.id} className="w-full" />
                  </article>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/30 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiCreditCard size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Order tidak ditemukan" : "Belum ada order"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada order yang sesuai dengan filter yang dipilih."
                : "Order yang dibuat akan muncul di sini."}
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
      {totalOrders > 0 && (
        <nav
          aria-label="Paginasi order"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
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
