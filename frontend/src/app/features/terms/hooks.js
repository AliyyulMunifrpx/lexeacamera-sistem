import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GetTerms, updateTerms } from "./api.js";

export function useGetTerms() {
  return useQuery({
    queryKey: ["terms"],
    queryFn: GetTerms,
  });
}
export function useUpdateTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (value) => updateTerms(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
  });
}
