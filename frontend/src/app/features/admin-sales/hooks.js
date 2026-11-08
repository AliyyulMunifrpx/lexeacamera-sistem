import { useQuery } from "@tanstack/react-query";

import { getAdminSales } from "./api.js";

/**
 * params: { period, date, from, to }
 * options.enabled: matikan fetch selama input belum valid (misalnya rentang belum lengkap).
 */
export function useGetAdminSales(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["admin-sales", params],
    queryFn: () => getAdminSales(params),
    enabled,
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });
}
