import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCamera,
  deleteCamera,
  getCamera,
  getCameras,
  updateCamera,
  updateCameraImages,
} from "./api.js";

export function useGetCameras(filters) {
  return useQuery({
    queryKey: ["cameras", filters],
    queryFn: () => getCameras(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateCamera() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["cameras", "create"],
    mutationFn: createCamera,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cameras"],
      });
    },
  });
}
export function useGetCamera(id) {
  return useQuery({
    queryKey: ["camera", id],
    queryFn: () => getCamera(id),
    enabled: Boolean(id),
  });
}
export function useDeleteCamera() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["cameras", "delete"],
    mutationFn: deleteCamera,
    onSuccess: async (_, id) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["cameras"],
        }),
        queryClient.removeQueries({
          queryKey: ["camera", id],
        }),
      ]);
    },
  });
}
export function useUpdateCamera() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["cameras", "update"],
    mutationFn: ({ id, data }) => updateCamera(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["camera", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["cameras"],
        }),
      ]);
    },
  });
}

export function useUpdateCameraImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["cameras", "update-images"],
    mutationFn: ({ id, formData }) => updateCameraImages(id, formData),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["camera", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["cameras"],
        }),
      ]);
    },
  });
}
