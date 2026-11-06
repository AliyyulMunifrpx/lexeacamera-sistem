import { useQuery } from "@tanstack/react-query";
import { getAdminMarketplaces } from "./api.js";

export function useGetAdminMarketplaces() {
  return useQuery({
    queryKey: ["marketplaces", "admin"],
    queryFn: getAdminMarketplaces,
    staleTime: 30 * 1000,
  });
}
