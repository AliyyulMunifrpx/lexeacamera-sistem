import { useQuery } from "@tanstack/react-query";
import { getHome } from "./api.js";

export function useGetHome() {
  return useQuery({
    queryKey: ["home"],
    queryFn: getHome,
  });
}
