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
    queryKey: ["admin-invoices", filters],
    queryFn: () => getInvoices(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetInvoice(id) {
  return useQuery({
    queryKey: ["admin-invoice", id],
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin-invoices", "create"],
    mutationFn: createInvoice,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }),
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin-invoices", "update"],
    mutationFn: ({ id, data }) => updateInvoice(id, data),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-invoice", id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }),
      ]),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin-invoices", "delete"],
    mutationFn: (id) => deleteInvoice(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }),
  });
}
