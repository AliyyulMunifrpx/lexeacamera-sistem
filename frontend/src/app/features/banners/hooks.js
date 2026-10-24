import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
} from "./api.js";

export function useGetBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: getBanners,
  });
}

export function useGetBanner(id) {
  return useQuery({
    queryKey: ["banners", id],
    queryFn: () => getBanner(id),
    enabled: Boolean(id),
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["banners", "create"],
    mutationFn: createBanner,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["banners"],
      }),
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["banners", "update"],
    mutationFn: ({ id, formData }) => updateBanner(id, formData),
    onSuccess: (_, variables) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["banners", variables.id],
        }),
      ]),
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["banners", "delete"],
    mutationFn: deleteBanner,
    onSuccess: (_, id) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["banners"],
        }),
        queryClient.removeQueries({
          queryKey: ["banners", id],
        }),
      ]),
  });
}
