"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation.js";
import { useGetInfiniteCameras } from "../../features/public/hooks.js";
import { useGetCategories } from "../../features/categories/hooks.js";
import ProductFilter, {
  DEFAULT_FILTERS,
  toApiFilters,
} from "../../../components/public/products/product-filter.jsx";
import CameraCard from "../../../components/public/home/camera-card.jsx";

function ProductsContent() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const { data: categoriesData } = useGetCategories();
  const categories = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData?.data ?? []);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetInfiniteCameras({ search, ...toApiFilters(filters) });

  // Gabungkan semua halaman, buang duplikat kalau data bergeser antar request.
  const items = useMemo(() => {
    const map = new Map();
    for (const page of data?.pages ?? []) {
      for (const item of page?.data ?? []) map.set(item.id, item);
    }
    return [...map.values()];
  }, [data]);

  const total = data?.pages?.at(-1)?.paging?.total ?? items.length;

  // Elemen penanda di dasar daftar: kalau terlihat, ambil halaman berikutnya.
  const sentinelRef = useRef(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // items.length ikut dipantau: kalau halaman baru belum memenuhi layar,
    // observer dibuat ulang dan langsung memicu ambil halaman berikutnya.
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <div className="w-full min-h-[100dvh] pt-16 px-4 bg-second/10">
      <ProductFilter
        value={filters}
        onChange={setFilters}
        categories={categories}
        className="pt-4"
      />

      {isPending ? (
        <p role="status" className="py-16 text-center text-second/60">
          Memuat produk…
        </p>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p role="alert" className="text-second">
            Gagal memuat produk.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full border-2 border-second px-4 text-second"
          >
            Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-second/60">
          Produk tidak ditemukan.
        </p>
      ) : (
        <>
          <div className="grid h-full w-full grid-cols-2 gap-2 py-4 lg:grid-cols-6">
            {items.map((item) => (
              <CameraCard key={item.id} data={item} />
            ))}
          </div>

          {hasNextPage ? (
            <div ref={sentinelRef} className="py-8 text-center">
              {isFetchingNextPage && (
                <p role="status" className="text-second/60">
                  Memuat produk…
                </p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-second/60">
              -------- Semua {total} produk sudah ditampilkan --------
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
