"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
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

import { useGetInvoices } from "../../../features/invoices/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import InvoiceFilters from "../../../../components/admin/invoice-filter.jsx";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

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
    setFilters({
      ...INITIAL_FILTERS,
      page: 1,
    });
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;

    setFilters((current) => ({
      ...current,
      page: nextPage,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiFileText size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen Invoice
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Cari dan kelola daftar invoice berdasarkan pelanggan, tanggal, dan
            status final.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-3 md:w-fit">
          <Link
            href="/admin/invoices/terms"
            className={`inline-flex items-center gap-2 rounded-full border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${FOCUS_RING}`}
          >
            <FiFileText size={16} />
            Template S&K
          </Link>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data invoice"
            className={`inline-flex items-center gap-2 rounded-full border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Memperbarui..." : "Perbarui"}
          </button>

          <Link
            href="/admin/invoices/create"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-second px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80 md:w-fit ${FOCUS_RING}`}
          >
            <FiPlus size={18} />
            Buat Invoice
          </Link>
        </div>
      </div>

      <InvoiceFilters
        draft={draftFilters}
        setDraft={setDraftFilters}
        onApply={handleApplyFilters}
        onReset={resetFilters}
        isFetching={isFetching}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar invoice</h2>

          <p className="mt-1 text-sm text-second/60">
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(totalInvoices)} invoice
          </p>
        </div>
      </div>

      <div className="relative min-h-64">
        {(isPending || isFetching) && (
          <div
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 rounded-full border border-second/30 bg-primary px-5 py-3 shadow-lg">
              <FiLoader className="animate-spin text-second" size={19} />

              <span className="text-sm font-medium text-second">
                {isPending ? "Memuat data invoice..." : "Memperbarui data..."}
              </span>
            </div>
          </div>
        )}

        {isError && !data ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-second/30 p-6 text-center">
            <FiFileText size={36} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">
              Gagal memuat invoice
            </h3>

            <p className="mt-2 text-sm text-second/60">
              Periksa koneksi atau sesi Anda, kemudian coba kembali.
            </p>

            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
            >
              Coba lagi
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
                className="block min-w-0"
              >
                <article className="h-full rounded-2xl border border-second/30 p-4 transition-colors hover:border-second/50 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-bold text-second sm:text-base">
                        {invoice.no_invoice}
                      </p>

                      <p className="mt-1 text-xs text-second/60">
                        {formatDate(invoice.created_at)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit shrink-0 items-center rounded-full px-4 py-1 text-xs font-semibold ${
                        invoice.is_final
                          ? "bg-grad text-primary"
                          : "border border-second/30 text-second/60"
                      }`}
                    >
                      {invoice.is_final ? "Final" : "Belum final"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 border-t border-second/30 pt-4 sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                        <FiUser size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-second/60">Pelanggan</p>

                        <p className="mt-1 break-words text-sm font-semibold text-second">
                          {invoice.customer_name || "-"}
                        </p>

                        {invoice.customer_whatsapp && (
                          <p className="mt-1 break-words text-xs text-second/60">
                            {invoice.customer_whatsapp}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                        <FiPackage size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-second/60">Item kamera</p>

                        <p className="mt-1 text-sm font-semibold text-second">
                          {formatNumber(invoice.item_count)} jenis
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                        <FiCreditCard size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-second/60">
                          Metode pembayaran
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-second">
                          {invoice.payment_method || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                        <FiTruck size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-second/60">Pengiriman</p>

                        <p className="mt-1 break-words text-sm font-semibold text-second">
                          {invoice.ship || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl bg-second p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-primary/60">
                        Subtotal sebelum diskon
                      </p>

                      <p className="mt-1 text-sm font-semibold text-primary">
                        {formatCurrency(invoice.subtotal)}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs text-primary/60">Total invoice</p>

                      <p className="mt-1 text-lg font-bold text-primary">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </div>
                  </div>

                  {(Number(invoice.store_discount) > 0 ||
                    Number(invoice.customer_discount) > 0) && (
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-second/60">
                      {Number(invoice.store_discount) > 0 && (
                        <span>
                          Diskon toko: {formatCurrency(invoice.store_discount)}
                        </span>
                      )}

                      {Number(invoice.customer_discount) > 0 && (
                        <span>
                          Diskon pelanggan:{" "}
                          {formatCurrency(invoice.customer_discount)}
                        </span>
                      )}
                    </div>
                  )}

                  {invoice.store_name && (
                    <p className="mt-4 break-words text-xs text-second/60">
                      Toko: {invoice.store_name}
                    </p>
                  )}
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-6 text-center">
            <FiFileText size={36} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">
              {hasFilters ? "Invoice tidak ditemukan" : "Belum ada invoice"}
            </h3>

            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada invoice yang sesuai dengan kriteria pencarian dan filter."
                : "Invoice akan muncul di sini setelah tersedia."}
            </p>

            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary hover:bg-second/80"
              >
                Reset filter
              </button>
            ) : (
              <Link
                href="/admin/invoices/create"
                className={`mt-4 inline-flex items-center gap-2 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80 ${FOCUS_RING}`}
              >
                <FiPlus size={16} />
                Buat Invoice
              </Link>
            )}
          </div>
        )}
      </div>

      {totalInvoices > 0 && (
        <div className="flex flex-col gap-4 border-t border-second/30 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => handlePageChange(safePage - 1)}
              className="inline-flex items-center gap-2 rounded-full border border-second/30 px-4 py-2.5 text-sm font-medium text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <FiChevronLeft size={17} />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() => handlePageChange(safePage + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-second px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Berikutnya
              <FiChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
