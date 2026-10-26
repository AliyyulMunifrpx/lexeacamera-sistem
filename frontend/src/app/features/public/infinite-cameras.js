import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../lib/api/client.js";

// Buang nilai kosong supaya nggak terkirim sebagai ?search=&condition=...
function compact(params) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );
}

// Satu halaman: { data: [...], paging: { page, per_page, total, total_pages } }
async function fetchCamerasPage({ filters, page, signal }) {
  const { data } = await api.get("/public/cameras", {
    params: compact({ ...filters, page }),
    signal,
  });

  return data;
}

// Filter yang sama = satu daftar. Halaman TIDAK masuk key: semua halaman
// tersimpan di dalam satu query.
export const infiniteCamerasKey = (filters) => [
  "public",
  "cameras",
  "infinite",
  compact(filters),
];

/**
 * Daftar kamera publik dengan infinite scroll.
 *
 * @param {object} filters search, condition, sort, category_id, min_price, max_price
 *                         (tanpa `page`, halaman diurus hook ini)
 */
export function useGetInfiniteCameras(filters) {
  return useInfiniteQuery({
    queryKey: infiniteCamerasKey(filters),
    queryFn: ({ pageParam, signal }) =>
      fetchCamerasPage({ filters, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const paging = lastPage?.paging;
      if (!paging) return undefined;

      return paging.page < paging.total_pages ? paging.page + 1 : undefined;
    },
    // Ganti filter: daftar lama tetap tampil sampai yang baru siap
    placeholderData: keepPreviousData,
    // Query ini bisa menyimpan banyak halaman, dan setiap refetch mengulang
    // SEMUA halaman satu per satu. Jangan refetch hanya karena tab difokuskan.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
