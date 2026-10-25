import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMarketplaces,
  createMarketplace,
  updateMarketplace,
  deleteMarketplace,
} from "./api.js";

export function useGetMarketplaces(filters = {}) {
  return useQuery({
    queryKey: ["marketplaces", filters],
    queryFn: () => getMarketplaces(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateMarketplace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["marketplaces", "create"],
    mutationFn: createMarketplace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplaces"],
      });
    },
  });
}

export function useUpdateMarketplace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["marketplaces", "update"],
    mutationFn: ({ id, formData }) => updateMarketplace(id, formData),
    onSuccess: async () => {
      // 💡 Perbaikan: Gunakan array di dalam queryKey untuk invalidate banyak sekaligus,
      // atau panggil invalidateQueries dua kali terpisah.
      await queryClient.invalidateQueries({
        queryKey: ["marketplaces"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["camera"],
      });
    },
  });
}

export function useDeleteMarketplace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["marketplaces", "delete"],
    mutationFn: deleteMarketplace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplaces"],
      });
    },
  });
}
