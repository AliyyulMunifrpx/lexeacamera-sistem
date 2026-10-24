import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  getInvoices,
  updateInvoice,
} from "./api.js";

export function useGetInvoices(filters) {
  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => getInvoices(filters),
    staleTime: 30 * 1000,
  });
}
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["invoices", "create"],
    mutationFn: createInvoice,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["invoices"],
      }),
  });
}

export function useGetInvoice(id) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["invoices", "delete"],
    mutationFn: deleteInvoice,
    onSuccess: (_, id) => {
      queryClient.removeQueries({
        queryKey: ["invoices", id],
      });

      return queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });
    },
  });
}
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["invoices", "update"],
    mutationFn: ({ id, payload }) => updateInvoice(id, payload),
    onSuccess: (updatedInvoice, { id }) => {
      queryClient.setQueryData(["invoices", id], updatedInvoice);

      return queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });
    },
  });
}
