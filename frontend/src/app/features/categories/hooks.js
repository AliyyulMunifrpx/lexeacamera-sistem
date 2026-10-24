import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./api.js";

export function useGetCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["categories", "create"],
    mutationFn: createCategory,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["categories", "update"],
    mutationFn: ({ id, name }) => updateCategory(id, name),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["categories", "delete"],
    mutationFn: deleteCategory,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      }),
  });
}