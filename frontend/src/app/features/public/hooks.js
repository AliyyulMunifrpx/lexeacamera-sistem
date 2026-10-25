import { useQuery } from "@tanstack/react-query";
import { getCameras, getHome } from "./api.js";

export function useGetHome() {
  return useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });
}
export function useGetCameras(filters) {
  return useQuery({
    queryKey: ["public cameras", filters],
    queryFn: () => getCameras(filters),
    placeholderData: (previousData) => previousData,
  });
}
