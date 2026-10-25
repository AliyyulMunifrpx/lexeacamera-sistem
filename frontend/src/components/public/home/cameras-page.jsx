"use client";

import { useEffect, useRef, useState } from "react";
import { FiLoader, FiSearch, FiX } from "react-icons/fi";

import {
  useGetCameras,
  useGetHome,
} from "../../../app/features/public/hooks.js";
import { useGetCategories } from "../../../app/features/categories/hooks.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";
// Sesuaikan path import CameraCard
import CameraCard from "./camera-card.jsx";
import MasonryGrid from "./masonry-grid.jsx";

const CONDITIONS = [
  { value: "", label: "Semua" },
  { value: "NEW", label: "Baru" },
  { value: "SECOND", label: "Bekas" },
];

const SORTS = [
  { value: "newest", label: "Terbaru" },
  { value: "price_asc", label: "Harga termurah" },
  { value: "price_desc", label: "Harga termahal" },
];

const selectClass =
  "w-full rounded-lg border border-second/30 bg-primary px-3 py-2 text-sm text-second outline-none transition-colors focus:border-second";

function getPageNumbers(current, total) {
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function CameraSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="aspect-square w-full animate-pulse rounded-lg bg-second/10" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-second/10" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-second/10" />
    </div>
  );
}

export default function CamerasHomePage({ searchRequest }) {
  const topRef = useRef(null);
  const isFirstRender = useRef(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("newest");
  const [categoryId, setCategoryId] = useState("");
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [page, setPage] = useState(1);

  const { data: store } = useGetHome();

  const categories = store?.categories || [];
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useGetCameras({
    search: debouncedSearch,
    condition,
    sort,
    category_id: categoryId,
    min_price: priceRange.min,
    max_price: priceRange.max,
    page,
  });
  // 🎯 Amankan dengan fallback `|| []` agar tidak error jika data belum ada
  const cameraHabis = (data?.data || []).filter((value) => {
    return value.stock === 0;
  });

  const cameraMasih = (data?.data || []).filter((value) => {
    return value.stock !== 0; // atau value.stock > 0
  });

  const cameras = [...cameraMasih, ...cameraHabis];
  console.log(cameraMasih);
  const paging = data?.paging;
  useEffect(() => {
    if (!searchRequest) return;

    setSearch(searchRequest.value);
    setDebouncedSearch(searchRequest.value);
    setPage(1);
  }, [searchRequest]);
  // Debounce pencarian supaya tidak request di setiap ketikan.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();

      setDebouncedSearch((previous) => {
        if (previous !== next) setPage(1);
        return next;
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  // Naik ke awal daftar saat pindah halaman (bukan saat pertama render).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  function changeCondition(value) {
    setCondition(value);
    setPage(1);
  }

  function changeSort(value) {
    setSort(value);
    setPage(1);
  }

  function changeCategory(value) {
    setCategoryId(value);
    setPage(1);
  }

  function applyPrice(event) {
    event.preventDefault();

    const min = priceDraft.min.trim();
    const max = priceDraft.max.trim();

    if (min !== "" && Number(min) < 0) {
      notify.error("Harga minimum tidak boleh negatif.");
      return;
    }

    if (max !== "" && Number(max) < 0) {
      notify.error("Harga maksimum tidak boleh negatif.");
      return;
    }

    if (min !== "" && max !== "" && Number(min) > Number(max)) {
      notify.error("Harga minimum tidak boleh lebih besar dari maksimum.");
      return;
    }

    setPriceRange({ min, max });
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCondition("");
    setSort("newest");
    setCategoryId("");
    setPriceDraft({ min: "", max: "" });
    setPriceRange({ min: "", max: "" });
    setPage(1);
  }

  const hasActiveFilters =
    debouncedSearch !== "" ||
    condition !== "" ||
    sort !== "newest" ||
    categoryId !== "" ||
    priceRange.min !== "" ||
    priceRange.max !== "";

  return (
    <div ref={topRef} className="w-full scroll-mt-16 space-y-4">
      {/* Kategori + urutan */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={categoryId}
          onChange={(event) => changeCategory(event.target.value)}
          className={selectClass}
          aria-label="Kategori"
        >
          <option value="">Semua kategori</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => changeSort(event.target.value)}
          className={selectClass}
          aria-label="Urutkan"
        >
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rentang harga */}
      <form onSubmit={applyPrice} className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={priceDraft.min}
          onChange={(event) =>
            setPriceDraft((previous) => ({
              ...previous,
              min: event.target.value,
            }))
          }
          placeholder="Harga min"
          className={`${selectClass} min-w-0`}
        />
        <span className="text-second/40">-</span>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={priceDraft.max}
          onChange={(event) =>
            setPriceDraft((previous) => ({
              ...previous,
              max: event.target.value,
            }))
          }
          placeholder="Harga maks"
          className={`${selectClass} min-w-0`}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-second px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          Terapkan
        </button>
      </form>

      {/* Ringkasan hasil */}
      <div className="flex items-center justify-between text-xs text-second/60">
        {/* Kondisi */}
        <div className="flex gap-2">
          {CONDITIONS.map((item) => {
            const isActive = condition === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => changeCondition(item.value)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-second bg-second text-primary"
                    : "border-second/20 text-second hover:bg-second/5"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="font-semibold text-primary bg-second2 px-4 py-1.5 rounded-full hover:bg-second2/80"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Daftar kamera */}
      {isLoading ? (
        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, index) => (
            <CameraSkeleton key={index} />
          ))}
        </div>
      ) : isError && !data ? (
        <div className="space-y-3 rounded-lg border border-second/20 p-6 text-center">
          <p className="text-sm text-second">Gagal memuat daftar kamera.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full bg-second px-5 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {isFetching ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
      ) : cameras.length === 0 ? (
        <p className="py-10 text-center text-sm text-second/50">
          {hasActiveFilters
            ? "Tidak ada kamera yang cocok dengan filter."
            : "Belum ada produk."}
        </p>
      ) : (
        <MasonryGrid
          className={`w-full grid-cols-2 transition-opacity md:grid-cols-4 lg:grid-cols-6 ${
            isPlaceholderData ? "opacity-60" : ""
          }`}
        >
          {cameras.map((item) => (
            <CameraCard key={item.id} data={item} />
          ))}
        </MasonryGrid>
      )}

      {/* Paginasi */}
      {paging && paging.total_pages > 1 && (
        <nav
          aria-label="Paginasi"
          className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
        >
          <button
            type="button"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={page <= 1 || isPlaceholderData}
            className="rounded-lg border border-second/20 px-3 py-1.5 text-sm text-second disabled:opacity-40"
          >
            Sebelumnya
          </button>

          {getPageNumbers(page, paging.total_pages).map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => setPage(number)}
              aria-current={number === page ? "page" : undefined}
              className={`size-9 rounded-lg border text-sm font-semibold transition-colors ${
                number === page
                  ? "border-second bg-second text-primary"
                  : "border-second/20 text-second hover:bg-second/5"
              }`}
            >
              {number}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              setPage((previous) => Math.min(paging.total_pages, previous + 1))
            }
            disabled={page >= paging.total_pages || isPlaceholderData}
            className="rounded-lg border border-second/20 px-3 py-1.5 text-sm text-second disabled:opacity-40"
          >
            Berikutnya
          </button>
        </nav>
      )}
    </div>
  );
}
