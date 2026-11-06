import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
} from "./api.js";

export function useGetCustomers(filters = {}) {
  return useQuery({
    queryKey: ["customers", filters],
    queryFn: () => getCustomers(filters),
    placeholderData: (previousData) => previousData,
  });
}
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,

    mutationKey: ["customer", "create"],
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      }),
  });
}
export function useGetCustomer(id) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
  });
}
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomer,
    mutationKey: ["customer", "delete"],
    onSuccess: async (_, id) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customers"],
        }),
        queryClient.removeQueries({
          queryKey: ["customer", id],
        }),
      ]);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["customer", "update-customer"],
    mutationFn: ({ id, data }) => updateCustomer(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["customer", variables.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customers"],
        }),
      ]);
    },
  });
}
