"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiCamera,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiPackage,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";

import { useGetAdminCameras } from "../../../features/admin-cameras/hooks.js";
import { useGetCategories } from "../../../features/categories/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import RefreshButton from "../../../../components/refresh-button.jsx";
import PrimaryButton from "../../../../components/primary-button.jsx";
import CancelButton from "./../../../../components/cancel-button";
import CameraCard from "../../../../components/owner/camera-card.jsx";

/* Sesuaikan jika rute detail kamera admin Anda berbeda. */
const CAMERA_PATH = (id) => `/admin/cameras/${id}`;

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

const LOW_STOCK_LIMIT = 3;
const SEARCH_DEBOUNCE_MS = 400;

const inputClass =
  "w-full min-w-0 rounded-xl border border-second/30 bg-primary px-4 py-2 text-base text-second placeholder:text-second/35 transition-colors duration-150 outline-none hover:border-second/30 focus:border-second4 focus:ring-4 focus:ring-second4/15 disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50";

/* -------------------------------- Helpers --------------------------------- */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(number) || 0);
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

function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function stockTag(stock) {
  const value = Number(stock) || 0;

  if (value === 0) return { tone: "failure", label: "Habis" };
  if (value <= LOW_STOCK_LIMIT) {
    return { tone: "pending", label: `${formatNumber(value)} unit` };
  }

  return { tone: "soft", label: `${formatNumber(value)} unit` };
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-grad p-4 text-primary shadow-lg shadow-second4/25 sm:p-8">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-second">
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-primary/80">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
          {formatNumber(value)}
        </p>
      </div>
    </div>
  );
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

function GridSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      <span className="sr-only">Memuat produk…</span>
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="h-72 animate-pulse rounded-2xl bg-second/10"
        />
      ))}
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function AdminCamerasPage() {
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const search = useDebouncedValue(searchInput.trim());

  // Pencarian berubah -> kembali ke halaman 1.
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const query = useGetAdminCameras({
    search,
    category_id: category,
    page: currentPage,
  });
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const categoriesQuery = useGetCategories();
  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const cameras = data?.data ?? [];
  const paging = data?.paging;

  const totalStock = useMemo(
    () => cameras.reduce((total, camera) => total + (camera.stock ?? 0), 0),
    [cameras],
  );

  const totalCameras = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? cameras.length;

  const startItem = totalCameras === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, totalCameras);

  const hasFilters = searchInput !== "" || category !== "";

  function resetFilters() {
    setSearchInput("");
    setCategory("");
    setCurrentPage(1);
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
            <FiCamera size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Daftar <span className="text-grad">Produk</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Lihat stok dan harga jual produk toko.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            onClick={() => refetch()}
            isFetching={isFetching}
            ariaLabel="Perbarui data produk"
          ></RefreshButton>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Jenis produk ditemukan"
          value={totalCameras}
          icon={FiCamera}
        />
        <SummaryCard
          label="Total stok pada halaman ini"
          value={totalStock}
          icon={FiPackage}
        />
      </div>

      {/* Filters — selalu terlihat */}
      <section
        aria-label="Filter produk"
        className="flex flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor="camera-search"
              className="mb-2 block text-sm font-semibold text-second"
            >
              Cari produk
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="camera-search"
                type="search"
                name="search"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nama atau SKU…"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="camera-category"
              className="mb-2 block text-sm font-semibold text-second"
            >
              Kategori
            </label>
            <select
              id="camera-category"
              name="category_id"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setCurrentPage(1);
              }}
              disabled={categoriesQuery.isPending || categoriesQuery.isError}
              className={inputClass}
            >
              <option value="">
                {categoriesQuery.isPending
                  ? "Memuat kategori…"
                  : categoriesQuery.isError
                    ? "Kategori tidak tersedia"
                    : "Semua kategori"}
              </option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <CancelButton
              type="button"
              onClick={resetFilters}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              Reset filter
            </CancelButton>
          </div>
        )}
      </section>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar Produk</h2>
          <p className="mt-2 text-sm text-second/60" aria-live="polite">
            {isPending ? (
              "Memuat produk…"
            ) : (
              <>
                Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)}{" "}
                dari {formatNumber(totalCameras)} produk
              </>
            )}
          </p>
        </div>
        {hasFilters && <Tag tone="strong">Filter aktif</Tag>}
      </div>

      {/* Content — hanya area ini yang reload */}
      <div className="relative min-h-40">
        {isFetching && !isPending && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200"
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
          <GridSkeleton />
        ) : isError && !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
            <FiAlertCircle
              size={32}
              className="text-second2"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-bold text-second">
              Gagal memuat data produk
            </h3>
            <p className="mt-2 max-w-md text-sm text-second/60">
              Periksa koneksi Anda, lalu coba kembali.
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
        ) : cameras.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} role="admin" />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiCamera size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Produk tidak ditemukan" : "Belum ada produk"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada produk yang sesuai dengan pencarian atau kategori yang dipilih."
                : "Produk akan muncul di sini setelah ditambahkan oleh owner."}
            </p>
            {hasFilters && (
              <CancelButton
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </CancelButton>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCameras > 0 && (
        <div className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <CancelButton
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </CancelButton>

            <PrimaryButton
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
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
