import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAdminCamera,
  getAdminCameras,
  updateAdminCameraDetails,
  updateAdminCameraImages,
  updateAdminCameraMarketplace,
} from "./api.js";

export function useGetAdminCameras(filters) {
  return useQuery({
    queryKey: ["admin-cameras", filters],
    queryFn: () => getAdminCameras(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetAdminCamera(id) {
  return useQuery({
    queryKey: ["admin-camera", id],
    queryFn: () => getAdminCamera(id),
    enabled: Boolean(id),
  });
}

function useInvalidateCamera() {
  const queryClient = useQueryClient();

  return (id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-camera", id] }),
      queryClient.invalidateQueries({ queryKey: ["admin-cameras"] }),
    ]);
}

export function useUpdateAdminCameraMarketplace() {
  const invalidate = useInvalidateCamera();

  return useMutation({
    mutationFn: ({ id, marketplace }) =>
      updateAdminCameraMarketplace(id, marketplace),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useUpdateAdminCameraImages() {
  const invalidate = useInvalidateCamera();

  return useMutation({
    mutationFn: ({ id, formData }) => updateAdminCameraImages(id, formData),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}
// Tambahkan ke hooks feature admin-cameras. Samakan invalidasi queryKey dengan
// yang dipakai useUpdateAdminCameraImages / useUpdateAdminCameraMarketplace,
// supaya detail dan daftar kamera ikut segar setelah disimpan.

export function useUpdateAdminCameraDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminCameraDetails,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cameras"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-camera", variables.id],
      });
    },
  });
}
