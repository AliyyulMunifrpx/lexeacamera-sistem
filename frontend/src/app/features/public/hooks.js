import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { createOrder, getCamera, getCameras, getHome } from "./api.js";

export function useGetHome() {
  return useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });
}
export function useGetCameras(filters = {}, options = {}) {
  return useQuery({
    queryKey: ["public cameras", filters],
    queryFn: () => getCameras(filters),
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

/* Scroll tanpa batas: tiap halaman diambil berurutan dan digabung di halaman produk. */
export function useGetInfiniteCameras(filters = {}) {
  return useInfiniteQuery({
    queryKey: ["public cameras infinite", filters],
    queryFn: ({ pageParam }) => getCameras({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const paging = lastPage?.paging;
      if (!paging) return undefined;
      return paging.page < paging.total_pages ? paging.page + 1 : undefined;
    },
  });
}

export function useGetCamera(id) {
  return useQuery({
    queryKey: ["public cameras", id],
    queryFn: () => getCamera(id),
  });
}
export function useCreateOrder() {
  return useMutation({
    mutationFn: createOrder,
  });
}
