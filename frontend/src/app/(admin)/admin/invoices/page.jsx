"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiFileText,
  FiLoader,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiTruck,
  FiUser,
} from "react-icons/fi";

import { useGetInvoices } from "../../../features/admin-invoices/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import InvoiceFilters from "../../../../components/owner/invoice-filter.jsx";
import RefreshButton from "./../../../../components/refresh-button";
import PrimaryButton from "./../../../../components/primary-button";
import CancelButton from "../../../../components/cancel-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const INITIAL_FILTERS = {
  search: "",
  created_from: "",
  created_to: "",
  is_final: "",
};

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}
const PAYMENT_LABEL = {
  PAID: "Lunas",
  DP: "DP",
  UNPAID: "Belum dibayar",
};
function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-4">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-second/60">{label}</p>
        <p className="mt-2 break-words text-sm font-semibold text-second">
          {children || "—"}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function InvoicesPage() {
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState({
    ...INITIAL_FILTERS,
    page: 1,
  });

  const query = useGetInvoices(filters);
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const debouncedSearch = useDebouncedValue(draftFilters.search.trim());
  const { created_from, created_to, is_final } = draftFilters;

  useEffect(() => {
    setFilters((current) =>
      current.search === debouncedSearch
        ? current
        : { ...current, search: debouncedSearch, page: 1 },
    );
  }, [debouncedSearch]);

  useEffect(() => {
    if (created_from && created_to && created_from > created_to) {
      notify.error("Tanggal awal tidak boleh melewati tanggal akhir.");
      return;
    }

    setFilters((current) =>
      current.created_from === created_from &&
      current.created_to === created_to &&
      current.is_final === is_final
        ? current
        : { ...current, created_from, created_to, is_final, page: 1 },
    );
  }, [created_from, created_to, is_final]);

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const invoices = data?.data ?? [];
  const paging = data?.paging;

  const totalInvoices = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? filters.page;
  const perPage = paging?.per_page ?? PER_PAGE;

  const startItem = totalInvoices === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, totalInvoices);

  const hasFilters = Boolean(
    filters.search ||
    filters.created_from ||
    filters.created_to ||
    filters.is_final !== "",
  );

  function handleApplyFilters(event) {
    event?.preventDefault();

    if (created_from && created_to && created_from > created_to) {
      notify.error("Tanggal awal tidak boleh melewati tanggal akhir.");
      return;
    }

    setFilters({
      search: draftFilters.search.trim(),
      created_from,
      created_to,
      is_final,
      page: 1,
    });
  }

  function resetFilters() {
    setDraftFilters({ ...INITIAL_FILTERS });
    setFilters({ ...INITIAL_FILTERS, page: 1 });
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;
    setFilters((current) => ({ ...current, page: nextPage }));
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
            <FiFileText size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen <span className="text-grad">Invoice</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Cari dan kelola daftar invoice berdasarkan pelanggan, nomor
              invoice, kamera, tanggal, dan status final.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            ariaLabel="Perbarui data invoice"
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </RefreshButton>

          <PrimaryButton href="/admin/invoices/create">
            <FiPlus size={16} aria-hidden="true" />
            Buat Invoice
          </PrimaryButton>
        </div>
      </header>

      {/* Filters — selalu terlihat, tidak ikut reload */}
      <InvoiceFilters
        draft={draftFilters}
        setDraft={setDraftFilters}
        onApply={handleApplyFilters}
        onReset={resetFilters}
        isFetching={isFetching}
      />

      {/* List header — selalu terlihat */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar invoice</h2>
          <p className="mt-2 text-sm text-second/60">
            {isPending ? (
              "Memuat invoice…"
            ) : (
              <>
                Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)}{" "}
                dari {formatNumber(totalInvoices)} invoice
              </>
            )}
          </p>
        </div>
        {hasFilters && <Tag tone="strong">Filter aktif</Tag>}
      </div>

      {/* Content — hanya area ini yang reload */}
      <div className="relative min-h-64">
        {/* Overlay fetching — hanya saat ada data lama & sedang refetch */}
        {isFetching && !isPending && (
          <div
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200"
            role="status"
            aria-live="polite"
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

        {isPending ? (
          /* Skeleton hanya di area konten — search bar & filter tetap */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-2xl bg-second/10"
              />
            ))}
          </div>
        ) : isError && !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
            <FiAlertTriangle
              size={32}
              className="text-second2"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-bold text-second">
              Gagal memuat invoice
            </h3>
            <p className="mt-2 max-w-md text-sm text-second/60">
              Periksa koneksi atau sesi Anda, kemudian coba kembali.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
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
        ) : invoices.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity duration-200 md:grid-cols-3 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/admin/invoices/${invoice.id}`}
                className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 sm:p-8 ${FOCUS_RING}`}
              >
                {/* Header card */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs font-semibold text-second/60">
                      {invoice.no_invoice}
                    </p>
                    {invoice.created_at && (
                      <p className="mt-2 text-xs text-second/60">
                        {formatDate(invoice.created_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {/* Type invoice */}
                    {invoice.type === "REFUND" ? (
                      <Tag tone="failure">Refund</Tag>
                    ) : (
                      <Tag tone="success">Penjualan</Tag>
                    )}

                    {/* Status pembayaran */}
                    {invoice.payment_status === "PAID" ? (
                      <Tag tone="strong">Lunas</Tag>
                    ) : invoice.payment_status === "DP" ? (
                      <Tag tone="soft">DP</Tag>
                    ) : (
                      <Tag tone="outline">Belum dibayar</Tag>
                    )}

                    {/* Status final */}
                    {invoice.is_final ? (
                      <Tag tone="grad">Final</Tag>
                    ) : (
                      <Tag tone="pending">Belum final</Tag>
                    )}
                  </div>
                </div>

                {/* Info grid */}
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-second/30 pt-4 sm:grid-cols-2">
                  <InfoRow icon={FiUser} label="Pelanggan">
                    {invoice.customer_name || "-"}
                  </InfoRow>

                  <InfoRow icon={FiPackage} label="Item kamera">
                    {formatNumber(invoice.item_count)} jenis
                  </InfoRow>

                  <InfoRow icon={FiCreditCard} label="Pembayaran">
                    {PAYMENT_LABEL[invoice.payment_status] ?? "Belum dibayar"}
                    {invoice.payment_method
                      ? ` · ${invoice.payment_method}`
                      : ""}
                  </InfoRow>
                  {invoice.ship && (
                    <InfoRow icon={FiTruck} label="Pengiriman">
                      {invoice.ship}
                    </InfoRow>
                  )}
                </div>

                {/* Ringkasan angka */}
                <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-second/10 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-second/60">
                      Subtotal sebelum diskon
                    </p>
                    <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                      {formatCurrency(invoice.subtotal)}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-xs text-second/60">Total invoice</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-second">
                      {formatCurrency(invoice.total_amount)}
                    </p>
                  </div>
                </div>

                {/* Diskon */}
                {(Number(invoice.store_discount) > 0 ||
                  Number(invoice.customer_discount) > 0) && (
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-second/60">
                    {Number(invoice.store_discount) > 0 && (
                      <span className="tabular-nums">
                        Diskon toko: {formatCurrency(invoice.store_discount)}
                      </span>
                    )}
                    {Number(invoice.customer_discount) > 0 && (
                      <span className="tabular-nums">
                        Diskon pelanggan:{" "}
                        {formatCurrency(invoice.customer_discount)}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiFileText size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Invoice tidak ditemukan" : "Belum ada invoice"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada invoice yang sesuai dengan kriteria pencarian dan filter."
                : "Invoice akan muncul di sini setelah tersedia."}
            </p>
            {hasFilters ? (
              <CancelButton
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </CancelButton>
            ) : (
              <PrimaryButton href="/admin/invoices/create">
                <FiPlus size={16} aria-hidden="true" />
                Buat Invoice
              </PrimaryButton>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalInvoices > 0 && (
        <div className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <CancelButton
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => handlePageChange(safePage - 1)}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </CancelButton>

            <PrimaryButton
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() => handlePageChange(safePage + 1)}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
