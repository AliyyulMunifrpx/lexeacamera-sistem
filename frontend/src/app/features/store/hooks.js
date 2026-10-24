import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, getStore, updateStore } from "./api.js";

export function useGetStore() {
  return useQuery({
    queryKey: ["store"],
    queryFn: getStore,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["store", "create"],
    mutationFn: createStore,
    onSuccess: (store) => {
      queryClient.setQueryData(["store"], store);
    },
  });
}
export function useUpdateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["store", "update"],
    mutationFn: updateStore,
    onSuccess: (store) => {
      queryClient.setQueryData(["store"], store);
    },
  });
}
