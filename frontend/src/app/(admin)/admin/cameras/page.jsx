"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiCamera,
  FiPackage,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiX,
  FiRefreshCw,
} from "react-icons/fi";

import CameraFilters from "../../../../components/admin/camera-filters.jsx";
import CameraCard from "../../../../components/admin/camera-card.jsx";
import { useGetCameras } from "../../../features/cameras/hooks.js";
import { useGetCategories } from "../../../features/categories/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import Link from "next/link.js";
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";
function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-grad p-5">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-second">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-primary/60">{label}</p>
        <p className="mt-1 text-2xl font-bold text-primary">
          {formatNumber(value)}
        </p>
      </div>
    </div>
  );
}

function LoadingIndicator({ initial = false }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 ${
        initial ? "min-h-64" : "py-8"
      }`}
      role="status"
      aria-live="polite"
    >
      <FiLoader className="animate-spin text-second" size={22} />
      <span className="text-sm text-second/60">
        {initial ? "Memuat data kamera..." : "Memperbarui daftar kamera..."}
      </span>
    </div>
  );
}

function CategoryRequiredModal({ onClose, onCreateCategory }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-required-title"
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second">
            <FiPackage size={24} />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-9 items-center justify-center rounded-full text-second/50 transition-colors hover:bg-second/5 hover:text-second"
          >
            <FiX size={20} />
          </button>
        </div>

        <h2
          id="category-required-title"
          className="mt-5 text-xl font-bold text-second"
        >
          Kategori belum tersedia
        </h2>

        <p className="mt-2 text-sm leading-6 text-second/60">
          Anda belum memiliki kategori kamera. Buat kategori terlebih dahulu
          sebelum menambahkan kamera agar produk dapat dikelompokkan dengan
          benar.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-second/15 px-5 py-3 text-sm font-semibold text-second transition-colors hover:bg-second/5"
          >
            Nanti saja
          </button>

          <Link
            type="button"
            href={"/admin/categories"}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
          >
            <FiPlus size={17} />
            Buat kategori
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CamerasPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryRequiredModal, setShowCategoryRequiredModal] =
    useState(false);

  const query = useGetCameras({
    search: search.trim(),
    min_price: minPrice,
    max_price: maxPrice,
    category_id: category,
    condition,
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
    maxPrice !== "";

  function handleCreateCamera() {
    if (categoriesQuery.isPending) {
      return;
    }

    if (categoriesQuery.isError) {
      const apiError = normalizeApiError(categoriesQuery.error);
      notify.error(apiError.message);
      return;
    }

    if (categories.length === 0) {
      setShowCategoryRequiredModal(true);
      return;
    }

    router.push("/admin/cameras/create");
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setCondition("");
    setMinPrice("");
    setMaxPrice("");
    setCurrentPage(1);
  }

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  if (isPending) {
    return <LoadingIndicator initial />;
  }

  if (isError && !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <h2 className="font-semibold text-second">Gagal memuat data kamera</h2>

        <p className="text-sm text-second/60">
          Periksa koneksi Anda, lalu coba kembali.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="">
          <div className="flex items-center gap-2">
            <FiCamera size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen Kamera
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Kelola inventaris kamera rental Anda.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-fit">
          {" "}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data dashboard"
            className={`inline-flex px-4 py-2 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Memperbarui..." : "Perbarui"}
          </button>
          <button
            type="button"
            onClick={handleCreateCamera}
            disabled={categoriesQuery.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 w-full md:w-fit py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {categoriesQuery.isPending ? (
              <FiLoader className="animate-spin" size={18} />
            ) : (
              <FiPlus size={18} />
            )}
            {categoriesQuery.isPending ? "Memuat kategori..." : "Tambah Kamera"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Jenis kamera ditemukan"
          value={totalCameras}
          icon={FiCamera}
        />

        <SummaryCard
          label="Total stok pada halaman ini"
          value={totalStock}
          icon={FiPackage}
        />
      </div>

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
        categories={categories}
        onReset={resetFilters}
        hasFilters={hasFilters}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar kamera</h2>

          <p className="mt-1 text-sm text-second/60">
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(totalCameras)} kamera
          </p>
        </div>
      </div>

      <div className="relative min-h-40">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200">
            <div className="flex items-center gap-3 rounded-full border border-second/30 bg-primary px-5 py-3 shadow-lg">
              <FiLoader className="animate-spin text-second" size={19} />

              <span className="text-sm font-medium text-second">
                Memperbarui data...
              </span>
            </div>
          </div>
        )}

        {cameras.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-5 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-6 text-center">
            <FiCamera size={36} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">
              Kamera tidak ditemukan
            </h3>

            <p className="mt-2 max-w-sm text-sm text-second/60">
              Tidak ada kamera yang sesuai dengan filter yang dipilih.
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary hover:bg-second/80"
              >
                Reset filter
              </button>
            )}
          </div>
        )}
      </div>

      {totalCameras > 0 && (
        <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="inline-flex items-center gap-2 rounded-full border border-second/30 px-4 py-2.5 text-sm font-medium text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <FiChevronLeft size={17} />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className="inline-flex items-center gap-2 rounded-full bg-second px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Berikutnya
              <FiChevronRight size={17} />
            </button>
          </div>
        </div>
      )}

      {showCategoryRequiredModal && (
        <CategoryRequiredModal
          onClose={() => setShowCategoryRequiredModal(false)}
          onCreateCategory={() => router.push("/admin/categories/create")}
        />
      )}
    </div>
  );
}
