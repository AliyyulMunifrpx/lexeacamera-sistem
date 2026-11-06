import { useQuery } from "@tanstack/react-query";
import { getAdminDashboard } from "./api.js";

export function useGetAdminDashboard() {
  return useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: getAdminDashboard,
    staleTime: 30 * 1000,
  });
}
