"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiLoader, FiSearch, FiX } from "react-icons/fi";

import { useGetHome } from "../../../app/features/public/hooks.js";
import { useGetInfiniteCameras } from "../../../app/features/public/infinite-cameras.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";
// Sesuaikan path import CameraCard
import CameraCard from "./camera-card.jsx";

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
  const sentinelRef = useRef(null);
  const isFirstRender = useRef(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("newest");
  const [categoryId, setCategoryId] = useState("");
  const [priceDraft, setPriceDraft] = useState({ min: "", max: "" });
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useGetInfiniteCameras({
    search: debouncedSearch,
    condition,
    sort,
    category_id: categoryId,
    min_price: priceRange.min,
    max_price: priceRange.max,
  });

  // Gabungkan semua halaman. Offset-based paging bisa mengulang satu kamera di
  // dua halaman kalau ada kamera baru di tengah scroll, jadi dibuang yang kembar.
  const loadedCameras = useMemo(() => {
    const seen = new Set();
    const items = [];

    for (const pageData of data?.pages ?? []) {
      for (const item of pageData?.data ?? []) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }

    return items;
  }, [data]);

  // Stok habis di akhir daftar. Dihitung dari SEMUA halaman yang sudah dimuat,
  // bukan per halaman, supaya yang habis nggak terselip di tengah daftar.
  const cameras = useMemo(
    () => [
      ...loadedCameras.filter((item) => item.stock !== 0),
      ...loadedCameras.filter((item) => item.stock === 0),
    ],
    [loadedCameras],
  );

  const total = data?.pages?.[0]?.paging?.total ?? 0;
  const loadedPages = data?.pages?.length ?? 0;

  useEffect(() => {
    if (!searchRequest) return;

    setSearch(searchRequest.value);
    setDebouncedSearch(searchRequest.value);
  }, [searchRequest]);
  // Debounce pencarian supaya tidak request di setiap ketikan.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  // Filter berubah: kalau daftar sudah di-scroll jauh, naik ke awal daftar.
  // Kalau awal daftar masih terlihat, nggak perlu bergeser.
  const filtersKey = JSON.stringify([
    debouncedSearch,
    condition,
    sort,
    categoryId,
    priceRange.min,
    priceRange.max,
  ]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const node = topRef.current;
    if (node && node.getBoundingClientRect().top < 0) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [filtersKey]);

  // Infinite scroll: saat penanda di bawah daftar mendekati layar (800px lagi),
  // muat halaman berikutnya. Observer dibuat ulang setiap selesai memuat, jadi
  // kalau penanda MASIH dekat (layar tinggi, atau halamannya sedikit) halaman
  // berikutnya langsung dimuat lagi.
  // Setelah gagal, jangan memuat otomatis: tunggu tombol "Coba lagi", kalau
  // tidak, error akan memicu request berulang tanpa henti.
  useEffect(() => {
    const node = sentinelRef.current;

    if (
      !node ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      isPlaceholderData
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isPlaceholderData,
    fetchNextPage,
    cameras.length,
  ]);

  function changeCondition(value) {
    setCondition(value);
  }

  function changeSort(value) {
    setSort(value);
  }

  function changeCategory(value) {
    setCategoryId(value);
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
  }

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCondition("");
    setSort("newest");
    setCategoryId("");
    setPriceDraft({ min: "", max: "" });
    setPriceRange({ min: "", max: "" });
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
        <>
          <div
            className={`w-full grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 transition-opacity ${
              isPlaceholderData ? "opacity-60" : ""
            }`}
          >
            {cameras.map((item) => (
              <CameraCard key={item.id} data={item} />
            ))}
          </div>

          {/* Penanda untuk infinite scroll: dibaca IntersectionObserver di atas */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

          {isFetchingNextPage && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-4 text-sm text-second/60"
            >
              <FiLoader className="animate-spin" size={18} />
              Memuat lebih banyak...
            </div>
          )}

          {isFetchNextPageError && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-second/70">
                Gagal memuat produk berikutnya.
              </p>
              <button
                type="button"
                onClick={() => fetchNextPage()}
                className="rounded-full bg-second px-5 py-2 text-sm font-semibold text-primary"
              >
                Coba lagi
              </button>
            </div>
          )}

          {!hasNextPage && loadedPages > 1 && (
            <p className="py-4 text-center text-xs text-second/40">
              -------- Semua {total} produk sudah ditampilkan --------
            </p>
          )}
        </>
      )}
    </div>
  );
}
