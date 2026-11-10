"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link.js";
import {
  FiCamera,
  FiPackage,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiX,
  FiRefreshCw,
  FiAlertCircle,
  FiUpload,
} from "react-icons/fi";

import CameraFilters from "../../../../components/owner/camera-filters.jsx";
import CameraCard from "../../../../components/owner/camera-card.jsx";
import { useGetCameras } from "../../../features/cameras/hooks.js";
import { useGetCategories } from "../../../features/categories/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import RefreshButton from "../../../../components/refresh-button.jsx";
import PrimaryButton from "../../../../components/primary-button.jsx";
import CancelButton from "./../../../../components/cancel-button";
import ExportCamerasButton from "../../../../components/owner/expres-cameras-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* -------------------------------- Helpers --------------------------------- */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Manajemen <span className="text-grad">Produk</span>
          </h1>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Kelola inventaris penjualan Produk Anda.
          </p>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertCircle size={32} className="text-second2" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat data Produk
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Periksa koneksi Anda, lalu coba kembali.
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

/* --------------------------------- Modal ---------------------------------- */

function CategoryRequiredModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-required-title"
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <FiPackage size={16} aria-hidden="true" />
          </div>

          <button type="button" onClick={onClose} aria-label="Tutup modal">
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="category-required-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Kategori belum tersedia
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Anda belum memiliki kategori Produk. Buat kategori terlebih dahulu
          sebelum menambahkan Produk agar produk dapat dikelompokkan dengan
          benar.
        </p>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <CancelButton type="button" onClick={onClose}>
            Nanti saja
          </CancelButton>

          <PrimaryButton href="/owner/categories">
            <FiPlus size={16} aria-hidden="true" />
            Buat kategori
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CamerasPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sku, setSku] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [color, setColor] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryRequiredModal, setShowCategoryRequiredModal] =
    useState(false);

  const query = useGetCameras({
    search: search.trim(),
    min_price: minPrice,
    max_price: maxPrice,
    category_id: category,
    condition,
    sku: sku.trim(),
    serial_number: serialNumber.trim(),
    min_stock: minStock,
    max_stock: maxStock,
    color: color.trim(),
    page: currentPage,
  });
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const categoriesQuery = useGetCategories();
  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (!isError || !error) return;
    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
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

  const hasFilters =
    search !== "" ||
    category !== "" ||
    condition !== "" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    sku !== "" ||
    serialNumber !== "" ||
    minStock !== "" ||
    maxStock !== "" ||
    color !== "";

  function handleCreateCamera() {
    if (categoriesQuery.isPending) return;

    if (categoriesQuery.isError) {
      const apiError = normalizeApiError(categoriesQuery.error);
      notify.error(apiError.message);
      return;
    }

    if (categories.length === 0) {
      setShowCategoryRequiredModal(true);
      return;
    }

    router.push("/owner/cameras/create");
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setCondition("");
    setMinPrice("");
    setMaxPrice("");
    setSku("");
    setSerialNumber("");
    setMinStock("");
    setMaxStock("");
    setColor("");
    setCurrentPage(1);
  }

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
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
              Manajemen <span className="text-grad">Produk</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola inventaris penjualan Produk Anda.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            onClick={() => refetch()}
            isFetching={isFetching}
            ariaLabel="Perbarui data produk"
          ></RefreshButton>
          <Link
            href="/owner/cameras/import"
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
          >
            <FiUpload size={16} aria-hidden="true" />
            Import Excel
          </Link>
          <ExportCamerasButton disabled={totalCameras === 0} />
          <PrimaryButton
            type="button"
            onClick={handleCreateCamera}
            disabled={categoriesQuery.isPending}
          >
            {categoriesQuery.isPending ? (
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <FiPlus size={16} aria-hidden="true" />
            )}
            {categoriesQuery.isPending ? "Memuat kategori…" : "Tambah Produk"}
          </PrimaryButton>
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

      {/* Filters */}
      <CameraFilters
        search={search}
        setSearch={(value) => updateFilter(setSearch, value)}
        category={category}
        setCategory={(value) => updateFilter(setCategory, value)}
        condition={condition}
        setCondition={(value) => updateFilter(setCondition, value)}
        minPrice={minPrice}
        setMinPrice={(value) => updateFilter(setMinPrice, value)}
        maxPrice={maxPrice}
        setMaxPrice={(value) => updateFilter(setMaxPrice, value)}
        sku={sku}
        setSku={(value) => updateFilter(setSku, value)}
        serialNumber={serialNumber}
        setSerialNumber={(value) => updateFilter(setSerialNumber, value)}
        minStock={minStock}
        setMinStock={(value) => updateFilter(setMinStock, value)}
        maxStock={maxStock}
        setMaxStock={(value) => updateFilter(setMaxStock, value)}
        color={color}
        setColor={(value) => updateFilter(setColor, value)}
        categories={categories}
        onReset={resetFilters}
        hasFilters={hasFilters}
      />

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar Produk</h2>
          <p className="mt-2 text-sm text-second/60">
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(totalCameras)} produk
          </p>
        </div>
        {hasFilters && <Tag tone="strong">Filter aktif</Tag>}
      </div>

      {/* Grid */}
      <div className="relative min-h-40">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200">
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

        {cameras.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} role="owner" />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiCamera size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              Produk tidak ditemukan
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              Tidak ada produk yang sesuai dengan filter yang dipilih.
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

      {showCategoryRequiredModal && (
        <CategoryRequiredModal
          onClose={() => setShowCategoryRequiredModal(false)}
        />
      )}
    </div>
  );
}
