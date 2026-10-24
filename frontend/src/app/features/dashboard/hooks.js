import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "./api.js";

export function useGetDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });
}
