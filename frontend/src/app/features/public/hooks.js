import { useMutation, useQuery } from "@tanstack/react-query";
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
